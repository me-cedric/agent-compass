// redact.mjs — shared secret/PII screen used by agent-trace, the redact CLI, and
// any other writer that must not persist credentials. Heuristic, not a full DLP
// scanner: catches PEM blocks, key:value secrets, common provider tokens, long
// base64 blobs, and emails. ponytail: name the ceiling — extend the patterns as
// real leaks are found rather than pretending this is exhaustive.

export const SECRET_RE = /(-----BEGIN |(?:password|secret|api[_-]?key|token)\s*[:=]\s*\S|bearer\s+[a-z0-9._-]{12,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|(?:secret|token|key|value|credential)\s*[:=]\s*[A-Za-z0-9+/]{40,}={0,2})/i
export const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i

// Return [{ line, kind }] for each offending line. kind: 'secret' | 'pii'.
export const findIssues = (text) => {
  const issues = []
  text.split(/\r?\n/).forEach((line, index) => {
    if (SECRET_RE.test(line)) issues.push({ line: index + 1, kind: 'secret' })
    if (EMAIL_RE.test(line)) issues.push({ line: index + 1, kind: 'pii' })
  })
  return issues
}
