/** Pure policies for bounded chat context and deterministic replies. */

export const DEFAULT_MAX_CONTEXT_CHARS = 60_000;

/**
 * Parse a positive integer setting or return its safe default.
 *
 * @param {string | null | undefined} value
 * @param {number} defaultValue
 */
export function positiveIntSetting(value, defaultValue) {
  if (typeof value !== "string" || !/^[-+]?\d+$/.test(value.trim())) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

/**
 * Keep ordered chunks within a character budget without splitting them.
 *
 * @template {{text?: unknown}} T
 * @param {Iterable<T>} chunks
 * @param {number} [maxChars]
 * @returns {T[]}
 */
export function boundedContextChunks(chunks, maxChars = DEFAULT_MAX_CONTEXT_CHARS) {
  if (maxChars < 1) return [];

  /** @type {T[]} */
  const selected = [];
  let used = 0;

  for (const chunk of chunks) {
    const text = String(chunk.text ?? "").trim();
    if (!text) continue;
    if (used + text.length > maxChars) break;
    selected.push(chunk);
    used += text.length;
  }

  return selected;
}

/**
 * Detect common supported languages using conservative textual markers.
 *
 * @param {string} question
 */
export function detectQuestionLanguage(question) {
  const words = question.toLocaleLowerCase().replace(/[^\p{L}\p{N}_¿¡]+/gu, " ");
  const normalized = ` ${words} `;
  const markers = {
    es: ["¿", "¡", " qué ", " cómo ", " cuál ", " dónde ", " quién ", " necesito ", " tengo ", " hola "],
    nl: [" wat ", " hoe ", " waar ", " waarom ", " welke ", " kunt ", " heb ", " hallo "],
    de: [" was ", " wie ", " wie viel ", " warum ", " welche ", " können ", " brauche ", " hallo "],
    fr: [" qu'est", " quoi ", " comment ", " où ", " pourquoi ", " quel", " pouvez ", " bonjour "],
    it: [" cosa ", " che ", " come ", " dove ", " perché ", " quale ", " puoi ", " bisogno ", " ciao "],
    pt: [" o que ", " como ", " onde ", " por que ", " qual ", " você ", " preciso ", " olá "],
  };

  let detected = "en";
  let highestScore = 0;
  for (const [language, languageMarkers] of Object.entries(markers)) {
    const score = languageMarkers.reduce((total, marker) => total + Number(normalized.includes(marker)), 0);
    if (score > highestScore) {
      detected = language;
      highestScore = score;
    }
  }
  return detected;
}

/**
 * Return Emma's deterministic no-context reply in the detected language.
 *
 * @param {string} question
 */
export function noInfoReply(question) {
  /** @type {Record<string, string>} */
  const messages = {
    es: "No tengo información en los documentos disponibles para responder eso.",
    nl: "Ik heb geen informatie in de beschikbare documenten om dat te beantwoorden.",
    de: "In den verfügbaren Dokumenten habe ich keine Informationen, um das zu beantworten.",
    fr: "Je ne dispose d'aucune information dans les documents disponibles pour répondre à cela.",
    it: "Non ho informazioni nei documenti disponibili per rispondere.",
    pt: "Não tenho informações nos documentos disponíveis para responder a isso.",
    en: "I do not have information in the available documents to answer that.",
  };
  const language = detectQuestionLanguage(question);
  return `[NO INFO]\n${messages[language]}`;
}
