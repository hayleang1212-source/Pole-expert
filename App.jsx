 import { useState, useEffect, useMemo } from "react";
import { Document, Page, Outline, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  Headset, ShieldCheck, Package, GraduationCap, ChevronLeft,
  FileCheck, RefreshCw, Clock,
  Search, PackageSearch, ClipboardList, BookOpen, Video, Award,
  FileText, Server, Wind, Gauge, Truck, Disc,
  MonitorSmartphone, Cpu, SlidersHorizontal, Thermometer, Droplet,
  Component, PlugZap, Eye, X, ChevronRight, PanelLeft, RotateCcw, RotateCw
} from "lucide-react";

// pdf.js a besoin d'un "worker" (un script séparé qui fait le rendu en
// arrière-plan). On le charge depuis un CDN pour rester simple — pas
// besoin de le copier dans votre projet.
import logo from "./assets/logo-kaeser.png";
import imagePoleExpert from "./assets/image-pole-expert.png";
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Adresse de votre backend Drive (voir dossier /backend). En développement,
// c'est votre serveur local ; une fois déployé sur Render/Railway, l'URL
// publique de ce service (ex: https://mon-backend.onrender.com).
const BACKEND_URL = "http://localhost:3001";

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
    searchable: true,
    itemIconColor: "#5B7C87",
    items: [
      { id: "compresseurs-vis", label: "Compresseurs à vis", icon: Server, driveFolderId: "12E98Q_dQ1bgy8nfu0yhffUJie5u36S6H" },
      { id: "vis-seche", label: "Vis sèche", icon: Server },
      { id: "surpresseur-vis", label: "Surpresseur à vis", icon: Gauge },
      { id: "mobilair", label: "Mobilair", icon: Truck },
      { id: "piston", label: "Piston", icon: Disc },
      { id: "traitement-air", label: "Traitement d'air", icon: Wind },
      { id: "sigma-control", label: "Sigma Control", icon: MonitorSmartphone },
      { id: "sam-40", label: "SAM 4.0", icon: Cpu },
      { id: "variateur", label: "Variateur", icon: SlidersHorizontal },
      { id: "instruments", label: "Instruments", icon: Thermometer },
      { id: "huile", label: "Huile", icon: Droplet },
      { id: "ada", label: "ADA", icon: Component },
      { id: "belimo", label: "BELIMO", icon: PlugZap },
    ],
  },
  {
    id: "garantie",
    label: "Garantie",
    description: "Enregistrements et demandes",
    icon: ShieldCheck,
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
    items: [
      { id: "guides", label: "Guides pratiques", icon: BookOpen },
      { id: "videos", label: "Tutoriels vidéo", icon: Video },
      { id: "certifications", label: "Certifications", icon: Award },
    ],
  },
];

export default function App() {
  // La pile de navigation : [] = menu principal
  // [{type:'category', data}] = sous-menu
  // [{type:'category', data}, {type:'item', data}] = page finale
  const [stack, setStack] = useState([]);

  const push = (entry) => setStack((s) => [...s, entry]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const goHome = () => setStack([]);

  const current = stack[stack.length - 1];
  const activeCategory = stack.find((s) => s.type === "category")?.data;

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
        {stack.length > 0 && (
          <button onClick={pop} style={backBtnStyle} aria-label="Retour">
            <ChevronLeft size={18} />
            Retour
          </button>
        )}

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
          {current?.type === "item"
            ? current.data.label
            : "Qualité, Performance et Satisfaction Client"}
        </p>
        
        {!activeCategory && (
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
        )}

        {/* fil d'ariane discret */}
        {stack.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "14px",
              fontSize: "12px",
              opacity: 0.85,
            }}
          >
            <span style={{ cursor: "pointer" }} onClick={goHome}>
              Accueil
            </span>
            {stack.map((s, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ opacity: 0.6 }}>/</span>
                <span>{s.data.label}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ---------- CONTENU ---------- */}
      <main style={{ flex: 1, padding: "40px 24px" }}>
        {!current && <MainMenu onSelect={(cat) => push({ type: "category", data: cat })} />}

        {current?.type === "category" && (
          <SubMenu
            category={current.data}
            onSelect={(item) => push({ type: "item", data: item })}
          />
        )}

        {current?.type === "item" && (
          <DetailPage category={activeCategory} item={current.data} />
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
// ÉCRAN 3 — PAGE FINALE (contenu réel + bouton retour déjà dans le bandeau)
// ---------------------------------------------------------------------------
function DetailPage({ category, item }) {
  const localDocuments = useMemo(() => getLocalDocuments(item.id), [item.id]);
  const [driveDocuments, setDriveDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);

  // Si l'item a un dossier Drive associé, on va chercher les PDF via le
  // backend (le fichier reste privé dans Drive, il transite à la demande).
  // Sinon, on utilise les PDF locaux détectés dans src/documents/.
  useEffect(() => {
    if (!item.driveFolderId) return;

    setLoading(true);
    setError(null);

    fetch(`${BACKEND_URL}/api/documents/${item.driveFolderId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Erreur réseau");
        return res.json();
      })
      .then((files) =>
        setDriveDocuments(
          files.map((f) => ({ id: f.id, name: f.name, url: `${BACKEND_URL}/api/file/${f.id}` }))
        )
      )
      .catch(() => setError("Impossible de charger les documents depuis Drive."))
      .finally(() => setLoading(false));
  }, [item.driveFolderId]);

  const documents = item.driveFolderId ? driveDocuments : localDocuments;

  return (
    <div style={{ maxWidth: "480px" }}>
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
          <p style={{ fontSize: "13px", color: COLORS.textMuted }}>
            {item.driveFolderId
              ? "Aucun document dans ce dossier Drive pour l'instant."
              : <>Aucun document dans <code>src/documents/{item.id}/</code> pour l'instant.</>}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setViewingDoc(doc)}
              style={docLinkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = COLORS.gold)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = COLORS.cardBorder)}
            >
              <FileText size={18} color={COLORS.gold} />
              <span style={{ flex: 1, fontSize: "13px", textAlign: "left" }}>{doc.name}</span>
              <Eye size={14} color={COLORS.textMuted} />
            </button>
          ))}
        </div>
      </div>

      {/* ---------- VISIONNEUSE PDF EN LECTURE SEULE ---------- */}
      {viewingDoc && <PdfViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visionneuse PDF : rendu page par page en <canvas> via react-pdf/pdf.js.
// Comme ce n'est plus le lecteur natif du navigateur, il n'y a aucun
// bouton "Télécharger" ou "Imprimer" natif — juste l'image de chaque page.
// Le clic droit est désactivé pour bloquer le "Enregistrer l'image sous...".
// Note honnête : ceci dissuade un usage courant, mais n'empêche pas un
// utilisateur déterminé (capture d'écran, outils développeur) — il n'y a
// pas de verrou 100% infranchissable pour un contenu affiché à l'écran.
// ---------------------------------------------------------------------------
function PdfViewer({ doc, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [showOutline, setShowOutline] = useState(false);
  const [hasOutline, setHasOutline] = useState(true); // optimiste, corrigé après chargement
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270

  // Blocage du clic droit au niveau du document entier tant que la
  // visionneuse est ouverte — plus fiable qu'un seul gestionnaire sur
  // un <div>, car ça couvre aussi les éléments internes de react-pdf.
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
              width={Math.min(900, window.innerWidth - (showOutline ? 340 : 80))}
            />
          </div>
          </div>
        </Document>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// COMPOSANT RÉUTILISABLE — une carte cliquable (icône + titre + description)
// ---------------------------------------------------------------------------
function Card({ icon: Icon, label, description, iconColor, onClick }) {
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
      <Icon size={description ? 40 : 34} color={iconColor || COLORS.gold} strokeWidth={1.6} />
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

// ---------------------------------------------------------------------------
// STYLES PARTAGÉS
// ---------------------------------------------------------------------------
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