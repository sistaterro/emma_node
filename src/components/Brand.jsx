/** @param {{evil?: boolean, compact?: boolean}} props */
export function Brand({ evil = false, compact = false }) {
  return (
    <a className={`brand ${compact ? "brand--compact" : ""}`} href="/" aria-label="Emma home">
      <span className={`brand__orb ${evil ? "brand__orb--evil" : ""}`} aria-hidden="true">
        <span />
      </span>
      <span>
        <strong>{evil ? "Evil Emma" : "Emma"}</strong>
        {!compact && <small>Hybrid intelligence</small>}
      </span>
    </a>
  );
}
