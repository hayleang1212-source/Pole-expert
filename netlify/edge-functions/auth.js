// ---------------------------------------------------------------------------
// Protection par mot de passe de tout le site, via une Edge Function
// Netlify (gratuite). Le navigateur affiche sa propre fenêtre native de
// connexion (identifiant + mot de passe) avant de charger la moindre page.
//
// Les identifiants ne sont JAMAIS écrits en dur ici : ils sont lus depuis
// des variables d'environnement Netlify (voir configuration ci-dessous),
// donc ils ne se retrouvent pas dans votre dépôt GitHub.
// ---------------------------------------------------------------------------
export default async (request, context) => {
  const authHeader = request.headers.get("authorization");

  const expectedUser = Netlify.env.get("BASIC_AUTH_USER");
  const expectedPass = Netlify.env.get("BASIC_AUTH_PASS");

  if (authHeader && authHeader.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice(6)); // enlève "Basic "
    const separatorIndex = decoded.indexOf(":");
    const user = decoded.slice(0, separatorIndex);
    const pass = decoded.slice(separatorIndex + 1);

    if (user === expectedUser && pass === expectedPass) {
      return context.next(); // identifiants corrects → on laisse passer
    }
  }

  // Pas d'en-tête, ou identifiants incorrects → on redemande l'authentification
  return new Response("Authentification requise.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Accès restreint", charset="UTF-8"',
    },
  });
};

// S'applique à toutes les pages du site.
export const config = { path: "/*" };
