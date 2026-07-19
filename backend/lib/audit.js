// Audit event writer (spec: data-api §2.8, §13; main design §12).
//
// Writes one row per security-relevant action into audit_events. Audit must
// never break the main flow: any write failure is logged to console and
// swallowed, so a broken audit sink can never turn a login into a 500.

const crypto = require('crypto');

// event: {
//   actorId, actorName, action, objectType, objectId, requestId,
//   beforeSummary, detail (object|string), ip, sessionId, userAgent
// }
function recordAudit(conn, event) {
  try {
    const detail =
      event.detail == null
        ? event.afterSummary || ''
        : typeof event.detail === 'string'
          ? event.detail
          : JSON.stringify(event.detail);
    conn
      .prepare(
        `INSERT INTO audit_events (
          id, actor_id, actor_name, action, object_type, object_id,
          request_id, before_summary, after_summary, ip, session_id, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        crypto.randomUUID(),
        event.actorId ?? null,
        event.actorName || '',
        event.action,
        event.objectType || '',
        event.objectId == null ? '' : String(event.objectId),
        event.requestId || '',
        event.beforeSummary || '',
        detail,
        event.ip || '',
        event.sessionId || '',
        event.userAgent || '',
        new Date().toISOString()
      );
  } catch (error) {
    console.error('audit_events write failed:', error.message);
  }
}

// Builds an audit event from an Express request (ip + user agent) merged with
// caller-supplied fields.
function auditEvent(req, fields) {
  return {
    ip: req.ip || '',
    userAgent: req.get('user-agent') || '',
    ...fields,
  };
}

module.exports = { recordAudit, auditEvent };
