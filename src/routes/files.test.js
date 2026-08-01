import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { hashPassword } from "../auth/passwords.js";
import { createConfig } from "../config.js";

/** @type {import("fastify").FastifyInstance[]} */ const apps=[];
/** @type {string[]} */ const roots=[];
afterEach(async()=>{await Promise.all(apps.splice(0).map(a=>a.close()));roots.splice(0).forEach(r=>rmSync(r,{recursive:true,force:true}));});
async function setup(){const root=mkdtempSync(join(tmpdir(),"emma-files-"));roots.push(root);const app=buildApp({logger:false},{config:createConfig({},root),modelCatalog:/** @type {any} */({availableModels:async()=>[]})});apps.push(app);await app.ready();if(!app.emmaDb)throw new Error("db");app.emmaDb.prepare("UPDATE users SET must_change_password=0 WHERE id=1").run();app.emmaDb.prepare("INSERT INTO users(username,password_hash,role,full_name,is_active,must_change_password,created_at) VALUES(?,?,?,?,1,0,?)").run("reader",await hashPassword("reader-password"),"read_only","Reader",new Date().toISOString());const login=async(/** @type {string} */ username,/** @type {string} */ password)=>(await app.inject({method:"POST",url:"/auth/login",payload:{username,password}})).json().token;return{app,root,admin:await login("admin","admin1234"),reader:await login("reader","reader-password")};}
const auth=(/** @type {string} */ token)=>({authorization:`Bearer ${token}`});
function multipart(/** @type {string} */ name,/** @type {string} */ text){const boundary="emma-boundary";return{headers:{"content-type":`multipart/form-data; boundary=${boundary}`},payload:`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/plain\r\n\r\n${text}\r\n--${boundary}--\r\n`};}

describe("file routes",()=>{
  it("uploads, indexes, lists, downloads and deletes scoped text",async()=>{const{app,root,admin}=await setup();const content=("This is useful factual source material with enough words to form a quality retrieval chunk for Emma and its users. ").repeat(10);const form=multipart("My Notes.txt",content);const uploaded=await app.inject({method:"POST",url:"/upload?scope=global",headers:{...auth(admin),...form.headers},payload:form.payload});expect(uploaded.statusCode).toBe(200);expect(uploaded.json()).toMatchObject({stored_as:"my_notes.txt",scope:"global"});expect(existsSync(join(root,"chunks","global","my_notes.json"))).toBe(true);expect(readFileSync(join(root,"chunks","global","my_notes.json"),"utf8")).not.toContain("embedding");const listed=(await app.inject({url:"/files",headers:auth(admin)})).json().files;expect(listed[0]).toMatchObject({stem:"my_notes",indexed:true});const download=await app.inject({url:"/files/global/my_notes/download",headers:auth(admin)});expect(download.statusCode).toBe(200);expect(download.body).toContain("useful factual");expect((await app.inject({method:"DELETE",url:"/files/global/my_notes",headers:auth(admin)})).statusCode).toBe(200);expect(existsSync(join(root,"chunks","global","my_notes.json"))).toBe(false);});
  it("rejects unsafe names, unsupported files, and read-only mutations",async()=>{const{app,admin,reader}=await setup();let form=multipart("../bad.md","bad");expect((await app.inject({method:"POST",url:"/upload",headers:{...auth(admin),...form.headers},payload:form.payload})).statusCode).toBe(400);form=multipart("safe.txt","safe content");expect((await app.inject({method:"POST",url:"/upload",headers:{...auth(reader),...form.headers},payload:form.payload})).statusCode).toBe(403);expect((await app.inject({method:"DELETE",url:"/files/global",headers:auth(reader)})).statusCode).toBe(403);});
});
