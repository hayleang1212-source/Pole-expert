import { useState, useEffect, useMemo } from "react";
import { Document, Page, Outline, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, onSnapshot, serverTimestamp, addDoc, collection } from "firebase/firestore";

// URL de votre application Web Google Apps Script (voir script.google.com
// → Déployer → Nouveau déploiement → Application Web). Le destinataire
// (hay.leang@kaeser.com) est défini directement dans le script, pas ici.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzjVe7qE7Xcn1nbofi5z2-S5d7_HSbTM_WkzU0WO5HRZFgUedywTilOC0-YLOSnbSAXMg/exec";
import {
  Headset, ShieldCheck, Package, GraduationCap, ChevronLeft,
  FileCheck, RefreshCw, Clock,
  Search, PackageSearch, ClipboardList, BookOpen, Video, Award,
  FileText, Server, Wind, Gauge, Truck, Disc,
  MonitorSmartphone, Cpu, SlidersHorizontal, Thermometer, Droplet,
  Component, PlugZap, Eye, X, ChevronRight, PanelLeft, RotateCcw, RotateCw, Settings, HelpCircle,
  ArrowRight, Paperclip
} from "lucide-react";

// pdf.js a besoin d'un "worker" (un script séparé qui fait le rendu en
// arrière-plan). On le charge depuis un CDN pour rester simple — pas
// besoin de le copier dans votre projet.
import logo from "./assets/logo-kaeser.png";
import imagePoleExpert from "./assets/image-pole-expert.png";
import iconSupportTechnique from "./assets/Support.png";
import iconGarantie from "./assets/Garantie.png";
import iconPiecesDetachees from "./assets/Pièces.png";
import iconFormation from "./assets/Formation.png";
import imgCompresseur from "./assets/Compresseur.png";
import imgVisSeche from "./assets/Vis sèche.png";
import imgSurpresseur from "./assets/Surpresseur.png";
import imgMobilair from "./assets/Mobilair.png";
import imgPiston from "./assets/Piston.png";
import imgTraitement from "./assets/Traitement.png";
import imgSigmaControl from "./assets/Sigma control.png";
import imgSAM from "./assets/SAM.png";
import imgVariateur from "./assets/Variateur.png";
import imgInstruments from "./assets/Instruments.png";
import imgHuile from "./assets/Huile.png";
import imgAda from "./assets/Ada.png";
import imgBelimo from "./assets/BELIMO.png";
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// ---------------------------------------------------------------------------
// PDF GOOGLE DRIVE — utilisé quand un item a un champ "driveFolderId".
// Le dossier Drive doit être partagé en "Tous les utilisateurs disposant
// du lien" pour que la clé API puisse le lire (elle ne peut pas accéder
// à des dossiers strictement privés).
// ---------------------------------------------------------------------------
const DRIVE_API_KEY = "AIzaSyBCzsfVrBWSXSxS_5cVi0ESsQ7cqiNXtPg";

async function getDriveDocuments(folderId) {
  const listUrl = new URL("https://www.googleapis.com/drive/v3/files");
  listUrl.searchParams.set(
    "q",
    `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`
  );
  listUrl.searchParams.set("fields", "files(id,name)");
  listUrl.searchParams.set("key", DRIVE_API_KEY);

  const res = await fetch(listUrl);
  if (!res.ok) throw new Error("Erreur API Drive");
  const data = await res.json();

  return (data.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    // alt=media renvoie directement les octets du PDF — react-pdf peut
    // charger cette URL comme n'importe quel fichier.
    url: `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${DRIVE_API_KEY}`,
  }));
}

// ---------------------------------------------------------------------------
// PDF LOCAUX — Vite scanne le dossier src/documents/ au démarrage.
// Pour ajouter un document à un produit : créez (si besoin) le dossier
// src/documents/ID_DU_PRODUIT/ et déposez-y le PDF. Exemple :
//   src/documents/compresseurs-vis/notice-installation.pdf
// Aucune configuration supplémentaire n'est nécessaire — la liste se
// met à jour automatiquement (rechargez la page si Vite ne le fait pas
// tout seul après l'ajout d'un nouveau fichier).
// ---------------------------------------------------------------------------
const PDF_MODULES = import.meta.glob("/src/documents/**/*.pdf", {
  eager: true,
  query: "?url",
  import: "default",
});

function getLocalDocuments(itemId) {
  return Object.entries(PDF_MODULES)
    .filter(([path]) => path.includes(`/documents/${itemId}/`))
    .map(([path, url]) => ({
      id: path,
      url,
      name: path.split("/").pop().replace(/\.pdf$/i, ""),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Couleurs de la charte — à ajuster à votre identité visuelle
const COLORS = {
  navy: "#0B1F3A",
  gold: "#F0AB00",
  goldDark: "#C98F00",
  bannerGray: "#7C8B8D",
  bg: "#FAFAF8",
  cardBorder: "#E7E7E3",
  textMuted: "#6B7280",
};

// ---------------------------------------------------------------------------
// STRUCTURE DES DONNÉES
// Chaque catégorie principale a un id, un label, une description courte,
// une icône, et une liste de sous-catégories (id / label / icône).
// C'est cette structure que vous éditez pour changer le contenu de l'app.
// ---------------------------------------------------------------------------
const CATEGORIES = [
  {
    id: "support-technique",
    label: "Support technique",
    description: "Documentation et assistance",
    icon: Headset,
    image: iconSupportTechnique,
    searchable: true,
    itemIconColor: "#5B7C87",
    items: [
      {
        id: "compresseurs-vis", label: "Compresseurs à vis", icon: Server, image: imgCompresseur,
        items: [
          { id: "sc2-vis", label: "Compresseur SC2", icon: Settings, image: imgCompresseur, driveFolderId: "1QAyqki_IItZ6vOtf2EuADDKmKGbLkFkU" },
          { id: "sc3-vis", label: "Compresseur SC3", icon: Settings, image: imgCompresseur, driveFolderId: "19Z-TuSJgRa3Aq3btywU2AsdT746WJwtX" },
          { id: "scb-vis", label: "Compresseur SCB", icon: Settings, image: imgCompresseur, driveFolderId: "1PqDpXZQGdGXvwpV421WyY9scanMmCQhC" },
        ],
      },
      { id: "vis-seche", label: "Vis sèche", icon: Server, image: imgVisSeche },
      { id: "surpresseur-vis", label: "Surpresseur à vis", icon: Gauge, image: imgSurpresseur },
      { id: "mobilair", label: "Mobilair", icon: Truck, image: imgMobilair },
      { id: "piston", label: "Piston", icon: Disc, image: imgPiston },
      { id: "traitement-air", label: "Traitement d'air", icon: Wind, image: imgTraitement },
      { id: "sigma-control", label: "Sigma Control", icon: MonitorSmartphone, image: imgSigmaControl },
      { id: "sam-40", label: "SAM 4.0", icon: Cpu, image: imgSAM },
      { id: "variateur", label: "Variateur", icon: SlidersHorizontal, image: imgVariateur },
      { id: "instruments", label: "Instruments", icon: Thermometer, image: imgInstruments },
      { id: "huile", label: "Huile", icon: Droplet, image: imgHuile },
      { id: "ada", label: "ADA", icon: Component, image: imgAda },
      { id: "belimo", label: "BELIMO", icon: PlugZap, image: imgBelimo },
    ],
  },
  {
    id: "garantie",
    label: "Garantie",
    description: "Enregistrements et demandes",
    icon: ShieldCheck,
    image: iconGarantie,
    items: [
      { id: "conditions", label: "Conditions de garantie", icon: FileCheck },
      { id: "duree", label: "Durée de couverture", icon: Clock },
      { id: "retour", label: "Retour / échange", icon: RefreshCw },
    ],
  },
  {
    id: "pieces-detachees",
    label: "Pièces détachées",
    description: "Catalogues et références",
    icon: Package,
    image: iconPiecesDetachees,
    items: [
      { id: "recherche", label: "Rechercher une pièce", icon: Search },
      { id: "catalogue", label: "Catalogue", icon: PackageSearch },
      { id: "commande", label: "Suivi de commande", icon: ClipboardList },
    ],
  },
  {
    id: "formation",
    label: "Formation",
    description: "Modules experts",
    icon: GraduationCap,
    image: iconFormation,
    items: [
      { id: "guides", label: "Guides pratiques", icon: BookOpen },
      { id: "videos", label: "Tutoriels vidéo", icon: Video },
      { id: "certifications", label: "Certifications", icon: Award },
    ],
  },
];

export default function App() {
  // ---------------------------------------------------------------------
  // AUTHENTIFICATION (Firebase Auth) — l'app entière est verrouillée tant
  // que l'utilisateur n'est pas connecté avec un compte autorisé.
  // ---------------------------------------------------------------------
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [kickedOut, setKickedOut] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) setKickedOut(false);
    });
    return unsubscribe;
  }, []);

  // -----------------------------------------------------------------------
  // SESSION UNIQUE — dès la connexion, on enregistre un identifiant de
  // session dans Firestore. On écoute ensuite ce document en temps réel :
  // si quelqu'un se reconnecte ailleurs avec les mêmes identifiants, son
  // login écrase ce document, et cette session-ci se ferme automatiquement
  // dès que le changement est détecté.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const sessionKey = `pole-expert-session-${user.uid}`;
    let sessionId = localStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem(sessionKey, sessionId);
    }

    const sessionRef = doc(db, "sessions", user.uid);

    setDoc(sessionRef, { sessionId, updatedAt: serverTimestamp() }).catch(() => {});

    const unsubscribe = onSnapshot(sessionRef, (snap) => {
      const activeSessionId = snap.data()?.sessionId;
      if (activeSessionId && activeSessionId !== sessionId) {
        setKickedOut(true);
        signOut(auth);
      }
    });

    return unsubscribe;
  }, [user]);

  // La pile de navigation : [] = menu principal
  // [{type:'category', data}] = sous-menu
  // [{type:'category', data}, {type:'item', data}] = page finale
  const [stack, setStack] = useState([]);

  const push = (entry) => setStack((s) => [...s, entry]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const goHome = () => setStack([]);

  const current = stack[stack.length - 1];
  const activeCategory = stack.find((s) => s.type === "category")?.data;

  // Tant qu'on ne sait pas encore si l'utilisateur est connecté, on
  // n'affiche rien (évite un flash de contenu protégé à l'écran).
  if (!authReady) return null;

  // Pas connecté → écran de connexion uniquement, rien d'autre n'est rendu.
  if (!user) {
    return <LoginScreen kickedOut={kickedOut} />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.navy,
        fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ---------- LISERÉ DE MARQUE ---------- */}
      <div style={{ height: "20px", background: "#FFC800"}} />

      {/* ---------- EN-TÊTE ---------- */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          background: "#FFFFFF",
          borderBottom: "1px solid #EFEFEC",
        }}
      >
      <img 
          src={logo} 
          alt="Kaeser Compresseurs" 
          style={{ height: "80px", width: "auto", display: "block" }} 
        />
        <button
          onClick={() => signOut(auth)}
          style={{
            fontSize: "13px",
            color: COLORS.textMuted,
            background: "none",
            border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: "8px",
            padding: "8px 14px",
            cursor: "pointer",
          }}
        >
          Se déconnecter ({user.email})
        </button>
      </header>

      {/* ---------- BANDEAU / FIL DE NAVIGATION ---------- */}
      <section
        style={{
          background: COLORS.bannerGray,
          color: "#FFFFFF",
          padding: "3px 24px 20px 24px", 
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <h1
          style={{
            fontSize: "40px",
            fontWeight: 800,
            margin: stack.length > 0 ? "10px 0 4px" : "0 0 4px",
            textAlign: "center",
          }}
        >
          {activeCategory ? activeCategory.label : "Le Pôle Expert"}
        </h1>
        <p style={{ fontStyle: "italic", fontSize: "14px", opacity: 0.9, margin: 0,textAlign: "center" }}>
          {current?.type === "item" || current?.type === "subcategory"
            ? current.data.label
            : "Qualité, Performance et Satisfaction Client"}
        </p>
        
        <img 
          src={imagePoleExpert} 
          alt="Illustration Pôle Expert" 
          style={{
            display: "block",
            margin: "10px auto 0", /* Centre l'image et met un espace de 24px au-dessus */
            height: "200px",       /* Ajustez cette valeur pour la taille souhaitée */
            width: "auto"
          }} 
        />

        {/* fil d'ariane cliquable */}
        {stack.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "14px",
              fontSize: "24px",
              opacity: 0.85,
            }}
          >
            <span style={{ cursor: "pointer" }} onClick={goHome}>
              Accueil
            </span>
            {stack.map((s, i) => {
              const isLast = i === stack.length - 1;
              return (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ opacity: 0.6 }}>/</span>
                  <span
                    style={{
                      cursor: isLast ? "default" : "pointer",
                      opacity: 1,
                      border: isLast ? `2px solid ${COLORS.gold}` : "none",
                      borderRadius: isLast ? "8px" : 0,
                      padding: isLast ? "2px 10px" : 0,
                    }}
                    onClick={() => {
                      if (!isLast) {
                        setStack((prev) => prev.slice(0, i + 1));
                      }
                    }}
                  >
                    {s.data.label}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- CONTENU ---------- */}
      <main style={{ flex: 1, padding: "40px 24px" }}>
        {!current && (
          <MainMenu
            onSelect={(cat) =>
              push(cat.items ? { type: "category", data: cat } : { type: "item", data: cat })
            }
          />
        )}

        {(current?.type === "category" || current?.type === "subcategory") && (
          <SubMenu
            category={current.data}
            onSelect={(item) =>
              push(
                item.items
                  ? { type: "subcategory", data: item }
                  : { type: "item", data: item }
              )
            }
          />
        )}

        {current?.type === "item" && (
          <DetailPage category={stack[stack.length - 2]?.data} item={current.data} />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ÉCRAN 1 — MENU PRINCIPAL (4 icônes)
// ---------------------------------------------------------------------------
function MainMenu({ onSelect }) {
  return (
    <div style={gridStyle}>
      {CATEGORIES.map((cat) => (
        <Card
          key={cat.id}
          icon={cat.icon}
          image={cat.image}
          label={cat.label}
          description={cat.description}
          onClick={() => onSelect(cat)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ÉCRAN 2 — SOUS-MENU (icônes de la catégorie choisie)
// ---------------------------------------------------------------------------
function SubMenu({ category, onSelect }) {
  const [query, setQuery] = useState("");

  const filteredItems = category.items.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      {category.searchable && (
        <div style={searchWrapStyle}>
          <Search size={18} color={COLORS.textMuted} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher..."
            style={searchInputStyle}
          />
        </div>
      )}

      <div style={gridStyle}>
        {filteredItems.map((item) => (
          <Card
            key={item.id}
            icon={item.icon}
            image={item.image}
            label={item.label}
            iconColor={category.itemIconColor}
            onClick={() => onSelect(item)}
          />
        ))}
      </div>

      {category.searchable && filteredItems.length === 0 && (
        <p style={{ color: COLORS.textMuted, fontSize: "14px" }}>
          Aucun résultat pour « {query} ».
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ÉCRAN 3 — PAGE FINALE (contenu réel)
// ---------------------------------------------------------------------------
function DetailPage({ category, item }) {
  const localDocuments = useMemo(() => getLocalDocuments(item.id), [item.id]);
  const [driveDocuments, setDriveDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState("");

  useEffect(() => {
    if (!item.driveFolderId) return;

    setLoading(true);
    setError(null);

    getDriveDocuments(item.driveFolderId)
      .then(setDriveDocuments)
      .catch(() => setError("Impossible de charger les documents depuis Drive."))
      .finally(() => setLoading(false));
  }, [item.driveFolderId]);

  const documents = item.driveFolderId ? driveDocuments : localDocuments;

  const [showExpertForm, setShowExpertForm] = useState(false);

  const handleViewSelected = () => {
    const doc = documents.find((d) => d.id === selectedDocId);
    if (doc) setViewingDoc(doc);
  };

  return (
    <div style={{ maxWidth: "480px" }}>
      {item.image ? (
        <img
          src={item.image}
          alt=""
          style={{ width: 100, height: 100, objectFit: "contain", marginBottom: "18px" }}
        />
      ) : (
        <div
          style={{
            display: "inline-flex",
            padding: "16px",
            borderRadius: "14px",
            background: "#FBF1D9",
            marginBottom: "18px",
          }}
        >
          <item.icon size={30} color={COLORS.gold} />
        </div>
      )}
      <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px" }}>{item.label}</h2>
      <p style={{ color: COLORS.textMuted, fontSize: "14px", lineHeight: 1.6, marginBottom: "22px" }}>
        Voici la page de destination pour « {item.label} », dans la catégorie « {category.label} ».
        C'est ici que vous mettez les vrais contrôles, réglages ou informations liés à cet élément.
      </p>

      <div>
        <h3
          style={{
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: COLORS.textMuted,
            marginBottom: "10px",
          }}
        >
          Notice d'utilisation
        </h3>

        {loading && <p style={{ fontSize: "13px", color: COLORS.textMuted }}>Chargement…</p>}

        {error && <p style={{ fontSize: "13px", color: "#C0392B" }}>{error}</p>}

        {!loading && !error && documents.length === 0 && (
          <p style={{ fontSize: "13px", color: COLORS.textMuted, fontStyle: "italic" }}>
            Aucun document disponible pour le moment.
          </p>
        )}

        {!loading && !error && documents.length > 0 && (
          <div style={{ display: "flex", gap: "8px" }}>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              style={selectStyle}
            >
              <option value="">Choisir un document…</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleViewSelected}
              disabled={!selectedDocId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: selectedDocId ? COLORS.gold : "#EFEFEC",
                color: selectedDocId ? COLORS.navy : COLORS.textMuted,
                border: "none",
                borderRadius: "10px",
                padding: "0 18px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: selectedDocId ? "pointer" : "default",
                whiteSpace: "nowrap",
              }}
            >
              <Eye size={16} />
              Afficher
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "28px" }}>
        <button
          onClick={() => setShowExpertForm(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: COLORS.gold,
            color: COLORS.navy,
            border: "none",
            borderRadius: "10px",
            padding: "14px 20px",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Une question ? Contactez nos experts
          <ArrowRight size={16} />
        </button>
      </div>

      {viewingDoc && <PdfViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />}

      {showExpertForm && (
        <ExpertRequestForm item={item} category={category} onClose={() => setShowExpertForm(false)} />
      )}
    </div>
  );
}

function ExpertRequestForm({ item, category, onClose }) {
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    machine: "",
    numeroSerie: "",
    reference: "",
    sujet: "Support Technique",
    message: "",
  });
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await addDoc(collection(db, "expertRequests"), {
        ...form,
        pieceJointeNom: fileName || null,
        produit: item.label,
        categorie: category?.label || null,
        requestedBy: auth.currentUser?.email || null,
        createdAt: serverTimestamp(),
      });

      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          nom: form.nom,
          prenom: form.prenom,
          email: form.email,
          machine: form.machine,
          numeroSerie: form.numeroSerie,
          reference: form.reference,
          sujet: form.sujet,
          message: form.message,
          produit: item.label,
          categorie: category?.label || "",
          pieceJointe: fileName || "Aucune",
        }),
      });

      setSent(true);
    } catch {
      setError("Impossible d'envoyer votre demande pour l'instant. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,31,58,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          maxWidth: "480px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "28px",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: COLORS.textMuted,
          }}
        >
          <X size={20} />
        </button>

        {sent ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px" }}>
              Demande envoyée
            </h2>
            <p style={{ color: COLORS.textMuted, fontSize: "14px", marginBottom: "20px" }}>
              Un expert vous répondra dans les meilleurs délais.
            </p>
            <button onClick={onClose} style={primaryBtnStyle}>
              Fermer
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "18px" }}>
              Nouvelle Demande d'Expertise
            </h2>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input required placeholder="Nom" value={form.nom} onChange={update("nom")} style={formInputStyle} />
              <input required placeholder="Prénom" value={form.prenom} onChange={update("prenom")} style={formInputStyle} />
              <input required type="email" placeholder="E-mail" value={form.email} onChange={update("email")} style={formInputStyle} />

              <FieldWithTooltip
                placeholder="Machine"
                value={form.machine}
                onChange={update("machine")}
                tooltip="Le modèle exact de la machine concernée (ex. CSDX SFC)."
              />
              <FieldWithTooltip
                placeholder="N° Série"
                value={form.numeroSerie}
                onChange={update("numeroSerie")}
                tooltip="Le numéro de série figure sur la plaque signalétique de la machine."
              />
              <FieldWithTooltip
                placeholder="Référence"
                value={form.reference}
                onChange={update("reference")}
                tooltip="Une référence interne de commande ou de dossier, si vous en avez une."
              />

              <select required value={form.sujet} onChange={update("sujet")} style={formInputStyle}>
                <option>Support Technique</option>
                <option>Garantie</option>
                <option>Pièces détachées</option>
                <option>Formation</option>
              </select>

              <textarea
                required
                placeholder="Votre message..."
                value={form.message}
                onChange={update("message")}
                rows={4}
                style={{ ...formInputStyle, resize: "vertical", fontFamily: "inherit" }}
              />

              <div>
                <label style={{ fontSize: "12px", color: COLORS.textMuted, display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <Paperclip size={14} />
                  Pièce jointe (optionnel)
                </label>
                <input
                  type="file"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
                  style={{ fontSize: "13px" }}
                />
              </div>

              {error && <p style={{ color: "#C0392B", fontSize: "13px" }}>{error}</p>}

              <button type="submit" disabled={submitting} style={{ ...primaryBtnStyle, opacity: submitting ? 0.7 : 1, marginTop: "8px" }}>
                {submitting ? "Envoi…" : "Envoyer"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function FieldWithTooltip({ tooltip, ...inputProps }) {
  return (
    <div style={{ position: "relative" }}>
      <input required {...inputProps} style={{ ...formInputStyle, paddingRight: "36px" }} />
      <span
        title={tooltip}
        style={{
          position: "absolute",
          right: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          color: COLORS.textMuted,
          cursor: "help",
          display: "flex",
        }}
      >
        <HelpCircle size={16} />
      </span>
    </div>
  );
}

const formInputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "8px",
  border: `1px solid ${COLORS.cardBorder}`,
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

const primaryBtnStyle = {
  background: COLORS.gold,
  color: COLORS.navy,
  border: "none",
  borderRadius: "10px",
  padding: "14px 20px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

function PdfViewer({ doc, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [showOutline, setShowOutline] = useState(true);
  const [hasOutline, setHasOutline] = useState(true);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const block = (e) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,31,58,0.85)",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: COLORS.navy,
          color: "#FFFFFF",
        }}
      >
        <span style={{ fontSize: "14px", fontWeight: 600 }}>{doc.name}</span>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button
            onClick={() => setShowOutline((s) => !s)}
            style={{ ...navBtnStyle, background: showOutline ? COLORS.gold : "rgba(255,255,255,0.15)" }}
            aria-label="Afficher les signets"
            title="Signets"
          >
            <PanelLeft size={16} color={showOutline ? COLORS.navy : "#FFFFFF"} />
          </button>

          {numPages && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
              <button
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
                style={navBtnStyle}
                aria-label="Page précédente"
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Page {pageNumber} / {numPages}
              </span>
              <button
                onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                disabled={pageNumber >= numPages}
                style={navBtnStyle}
                aria-label="Page suivante"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
              style={navBtnStyle}
              aria-label="Pivoter vers la gauche"
              title="Pivoter à gauche"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              style={navBtnStyle}
              aria-label="Pivoter vers la droite"
              title="Pivoter à droite"
            >
              <RotateCw size={16} />
            </button>
          </div>

          <button onClick={onClose} style={closeBtnStyle}>
            <X size={16} />
            Fermer
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Document
          file={doc.url}
          onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
          loading={<p style={{ color: "#FFFFFF", padding: "24px" }}>Chargement du document…</p>}
          error={<p style={{ color: "#FFFFFF", padding: "24px" }}>Impossible d'afficher ce PDF.</p>}
        >
          <div style={{ display: "flex", flex: 1, height: "100%" }}>
          {showOutline && (
            <div
              style={{
                width: "260px",
                flexShrink: 0,
                overflow: "auto",
                background: "#FFFFFF",
                borderRight: `1px solid ${COLORS.cardBorder}`,
                padding: "16px",
              }}
            >
              <h4
                style={{
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: COLORS.textMuted,
                  marginBottom: "10px",
                }}
              >
                Signets
              </h4>
              <Outline
                onLoadSuccess={(outline) => setHasOutline(Boolean(outline && outline.length))}
                onItemClick={({ pageNumber: pn }) => setPageNumber(pn)}
              />
              {!hasOutline && (
                <p style={{ fontSize: "12px", color: COLORS.textMuted }}>
                  Ce PDF ne contient pas de signets.
                </p>
              )}
            </div>
          )}

          <div
            onContextMenu={(e) => e.preventDefault()}
            style={{
              flex: 1,
              overflow: "auto",
              display: "flex",
              justifyContent: "center",
              padding: "24px",
              background: "#5A5A5A",
            }}
          >
            <Page
              pageNumber={pageNumber}
              rotate={rotation}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              width={Math.min(1400, window.innerWidth - (showOutline ? 300 : 48))}
            />
          </div>
          </div>
        </Document>
      </div>
    </div>
  );
}

function Card({ icon: Icon, image, label, description, iconColor, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: "14px",
        padding: description ? "36px 20px" : "24px 14px",
        minHeight: "300px",
        borderRadius: "14px",
        border: `1px solid ${COLORS.cardBorder}`,
        background: "#FFFFFF",
        color: COLORS.navy,
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(11,31,58,0.04)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "0 8px 20px rgba(11,31,58,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(11,31,58,0.04)";
      }}
    >
      {image ? (
        <img
          src={image}
          alt=""
          style={{ width: description ? 220 : 200, height: description ? 220 : 200, objectFit: "contain" }}
        />
      ) : (
        <Icon size={description ? 40 : 34} color={iconColor || COLORS.gold} strokeWidth={1.6} />
      )}
      <div>
        <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "0.01em", textTransform: description ? "uppercase" : "none" }}>
          {label}
        </div>
        {description && (
          <div style={{ fontSize: "12.5px", color: COLORS.textMuted, marginTop: "6px" }}>
            {description}
          </div>
        )}
      </div>
    </button>
  );
}

function LoginScreen({ kickedOut }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(
        err.code === "auth/invalid-credential" || err.code === "auth/wrong-password"
          ? "E-mail ou mot de passe incorrect."
          : err.code === "auth/user-not-found"
          ? "Aucun compte trouvé avec cet e-mail."
          : "Impossible de se connecter. Réessayez."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Entrez votre e-mail ci-dessus, puis cliquez à nouveau sur ce lien.");
      return;
    }
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch {
      setError("Impossible d'envoyer l'e-mail de réinitialisation.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        background: COLORS.bg,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: "20px",
      }}
    >
      <img src={logo} alt="Kaeser Compresseurs" style={{ height: "70px", width: "auto" }} />

      {kickedOut && (
        <p style={alertStyle}>
          Vous avez été déconnecté(e) car ce compte a été utilisé sur un autre appareil.
        </p>
      )}

      {resetSent && (
        <p style={{ ...alertStyle, background: "#EAF7EE", color: "#1E7A34" }}>
          E-mail envoyé — suivez le lien reçu pour définir votre mot de passe, puis revenez vous connecter ici.
        </p>
      )}

      {error && <p style={alertStyle}>{error}</p>}

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", maxWidth: "320px" }}
      >
        <input
          type="email"
          placeholder="votre.email@kaeser.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            background: COLORS.gold,
            color: COLORS.navy,
            border: "none",
            borderRadius: "10px",
            padding: "14px 28px",
            fontSize: "14px",
            fontWeight: 700,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <button
        onClick={handleForgotPassword}
        style={{ background: "none", border: "none", color: COLORS.textMuted, fontSize: "13px", cursor: "pointer", textDecoration: "underline" }}
      >
        Mot de passe oublié / première connexion
      </button>

      <p style={{ color: COLORS.textMuted, fontSize: "12px", maxWidth: "320px", textAlign: "center" }}>
        Cette application est réservée aux utilisateurs autorisés par l'administrateur.
      </p>
    </div>
  );
}

const alertStyle = {
  background: "#FBE9E7",
  color: "#C0392B",
  fontSize: "13px",
  padding: "10px 16px",
  borderRadius: "8px",
  maxWidth: "320px",
  textAlign: "center",
};

const inputStyle = {
  padding: "12px 14px",
  borderRadius: "8px",
  border: `1px solid ${COLORS.cardBorder}`,
  fontSize: "14px",
  outline: "none",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 240px))",
  gap: "18px",
  maxWidth: "1100px",
  margin: "0 auto",
  justifyContent: "center"
};

const searchWrapStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  maxWidth: "480px",
  marginLeft: "auto",
  marginBottom: "28px",
  padding: "12px 16px",
  borderRadius: "10px",
  border: `1px solid ${COLORS.cardBorder}`,
  background: "#FFFFFF",
};

const searchInputStyle = {
  flex: 1,
  border: "none",
  outline: "none",
  fontSize: "14px",
  color: COLORS.navy,
  background: "transparent",
};

const selectStyle = {
  flex: 1,
  padding: "0 14px",
  height: "42px",
  borderRadius: "10px",
  border: `1px solid ${COLORS.cardBorder}`,
  background: "#FFFFFF",
  color: COLORS.navy,
  fontSize: "13px",
};

const docLinkStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "12px 14px",
  borderRadius: "10px",
  border: `1px solid ${COLORS.cardBorder}`,
  background: "#FFFFFF",
  color: COLORS.navy,
  textDecoration: "none",
  transition: "border-color 0.15s ease",
};

const navBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.15)",
  border: "none",
  color: "#FFFFFF",
  cursor: "pointer",
  padding: "6px",
  borderRadius: "6px",
};

const closeBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  background: "rgba(255,255,255,0.15)",
  border: "none",
  color: "#FFFFFF",
  fontSize: "13px",
  cursor: "pointer",
  padding: "6px 12px",
  borderRadius: "8px",
};

const backBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  background: "rgba(255,255,255,0.15)",
  border: "none",
  color: "#FFFFFF",
  fontSize: "13px",
  cursor: "pointer",
  padding: "6px 10px",
  borderRadius: "8px",
};
