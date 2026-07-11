// ---------------------------------------------------------------------------
// POST /.netlify/functions/session-check
// Appelée périodiquement par l'app pendant qu'un utilisateur est connecté.
// Compare l'identifiant de session du navigateur à celui enregistré comme
// "actif" pour cet utilisateur. S'ils ne correspondent plus, c'est qu'une
// connexion plus récente a eu lieu ailleurs — on répond invalid:true et
// l'app déconnecte automatiquement cette session.
// ---------------------------------------------------------------------------
import { getStore } from "@netlify/blobs";

export const handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: "Non authentifié" }) };
  }

  let sessionId;
  try {
    sessionId = JSON.parse(event.body).sessionId;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "sessionId manquant" }) };
  }

  const store = getStore("sessions");
  const activeSessionId = await store.get(user.sub);

  const valid = activeSessionId === sessionId;

  return { statusCode: 200, body: JSON.stringify({ valid }) };
};
