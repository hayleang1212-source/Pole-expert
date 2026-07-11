// ---------------------------------------------------------------------------
// POST /.netlify/functions/session-register
// Appelée juste après la connexion. Enregistre l'identifiant de session
// envoyé par le navigateur comme LA session active de cet utilisateur —
// écrasant automatiquement toute session précédente (donc un ancien
// appareil connecté avec les mêmes identifiants sera invalidé).
//
// L'utilisateur est identifié via le jeton Netlify Identity envoyé dans
// l'en-tête Authorization : Netlify le vérifie et remplit
// context.clientContext.user automatiquement — on n'a pas à revalider
// le jeton nous-mêmes.
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
  await store.set(user.sub, sessionId);

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
