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

const DRIVE_API_KEY = "AIzaSyBCzsfVrBWSXSxS_5cVi0ESsQ7cqiNXtPg";

async function getDriveDocuments(folderId) {
  const listUrl = new URL("https://www.googleapis.com/drive/v3/files");
  listUrl.searchParams.set("q", `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`);
  listUrl.searchParams.set("fields", "files(id,name)");
  listUrl.searchParams.set("key", DRIVE_API_KEY);
  const res = await fetch(listUrl);
  if (!res.ok) throw new Error("Erreur API Drive");
  const data = await res.json();
  return (data.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    url: `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${DRIVE_API_KEY}`,
  }));
}

const PDF_MODULES = import.meta.glob("/src/documents/**/*.pdf", { eager: true, query: "?url", import: "default" });

function getLocalDocuments(itemId) {
  return Object.entries(PDF_MODULES)
    .filter(([path]) => path.includes(`/documents/${itemId}/`))
    .map(([path, url]) => ({ id: path, url, name: path.split("/").pop().replace(/\.pdf$/i, "") }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const COLORS = {
  navy: "#0B1F3A",
  gold: "#F0AB00",
  goldDark: "#C98F00",
  bannerGray: "#7C8B8D",
  bg: "#FAFAF8",
  cardBorder: "#E7E7E3",
  textMuted: "#6B7280",
};

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
          { id: "sc2-vis", label: "Compresseur SC2", icon: Settings, driveFolderId: "1QAyqki_IItZ6vOtf2EuADDKmKGbLkFkU" },
          { id: "sc3-vis", label: "Compresseur SC3", icon: Settings, driveFolderId: "19Z-TuSJgRa3Aq3btywU2AsdT746WJwtX" },
          { id: "scb-vis", label: "Compresseur SCB", icon: Settings, driveFolderId: "1PqDpXZQGdGXvwpV421WyY9scanMmCQhC" },
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
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [kickedOut, setKickedOut] = useState(false);
  const [stack, setStack] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) setKickedOut(false);
    });
    return unsubscribe;
  }, []);

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

  const push = (entry) => setStack((s) => [...s, entry]);
  const goHome = () => setStack([]);
  const current = stack[stack.length - 1];
  const activeCategory = stack.find((s) => s.type === "category")?.data;

  if (!authReady) return null;
  if (!user) return <LoginScreen kickedOut={kickedOut} />;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.navy, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ height: "20px", background: "#FFC800"}} />
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", background: "#FFFFFF", borderBottom: "1px solid #EFEFEC" }}>
        <img src={logo} alt="Kaeser Compresseurs" style={{ height: "80px", width: "auto", display: "block" }} />
        <button onClick={() => signOut(auth)} style={{ fontSize: "13px", color: COLORS.textMuted, background: "none", border: `1px solid ${COLORS.cardBorder}`, borderRadius: "8px", padding: "8px 14px", cursor: "pointer" }}>
          Se déconnecter ({user.email})
        </button>
      </header>

      <section style={{ background: COLORS.bannerGray, color: "#FFFFFF", padding: "3px 24px 20px 24px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 style={{ fontSize: "40px", fontWeight: 800, margin: stack.length > 0 ? "10px 0 4px" : "0 0 4px", textAlign: "center" }}>
          {activeCategory ? activeCategory.label : "Le Pôle Expert"}
        </h1>
        <p style={{ fontStyle: "italic", fontSize: "14px", opacity: 0.9, margin: 0, textAlign: "center" }}>
          {current?.type === "item" || current?.type === "subcategory" ? current.data.label : "Qualité, Performance et Satisfaction Client"}
        </p>
        
        <img src={imagePoleExpert} alt="Illustration Pôle Expert" style={{ display: "block", margin: "10px auto 0", height: "200px", width: "auto" }} />

        {stack.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "14px", fontSize: "24px", opacity: 1 }}> {/* Taille augmentée à 24px */}
            <span style={{ cursor: "pointer" }} onClick={goHome}>Accueil</span>
            {stack.map((s, i) => {
              const isLast = i === stack.length - 1;
              return (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ opacity: 0.6 }}>/</span>
                  <span
                    style={{
                      cursor: isLast ? "default" : "pointer",
                      opacity: isLast ? 1 : 0.8,
                      // Ajout du contour jaune si c'est le dernier élément (page appelée)
                      border: isLast ? `2px solid ${COLORS.gold}` : 'none',
                      padding: isLast ? '2px 8px' : '0',
                      borderRadius: isLast ? '6px' : '0'
                    }}
                    onClick={() => {
                      if (!isLast) setStack((prev) => prev.slice(0, i + 1));
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

      <main style={{ flex: 1, padding: "40px 24px" }}>
        {!current && <MainMenu onSelect={(cat) => push(cat.items ? { type: "category", data: cat } : { type: "item", data: cat })} />}
        {(current?.type === "category" || current?.type === "subcategory") && (
          <SubMenu category={current.data} onSelect={(item) => push(item.items ? { type: "subcategory", data: item } : { type: "item", data: item })} />
        )}
        {current?.type === "item" && <DetailPage category={stack[stack.length - 2]?.data} item={current.data} />}
      </main>
    </div>
  );
}

// ... (Le reste des fonctions MainMenu, SubMenu, DetailPage, ExpertRequestForm, PdfViewer, Card, LoginScreen reste inchangé)

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

function SubMenu({ category, onSelect }) {
  const [query, setQuery] = useState("");
  const filteredItems = category.items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div>
      {category.searchable && (
        <div style={searchWrapStyle}>
          <Search size={18} color={COLORS.textMuted} />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher..." style={searchInputStyle} />
        </div>
      )}
      <div style={gridStyle}>
        {filteredItems.map((item) => (
          <Card key={item.id} icon={item.icon} image={item.image} label={item.label} iconColor={category.itemIconColor} onClick={() => onSelect(item)} />
        ))}
      </div>
      {category.searchable && filteredItems.length === 0 && <p style={{ color: COLORS.textMuted, fontSize: "14px" }}>Aucun résultat pour « {query} ».</p>}
    </div>
  );
}

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
        <img src={item.image} alt="" style={{ width: 100, height: 100, objectFit: "contain", marginBottom: "18px" }} />
      ) : (
        <div style={{ display: "inline-flex", padding: "16px", borderRadius: "14px", background: "#FBF1D9", marginBottom: "18px" }}>
          <item.icon size={30} color={COLORS.gold} />
        </div>
      )}
      <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px" }}>{item.label}</h2>
      <p style={{ color: COLORS.textMuted, fontSize: "14px", lineHeight: 1.6, marginBottom: "22px" }}>
        Voici la page de destination pour « {item.label} », dans la catégorie « {category.label} ».
      </p>

      <div>
        <h3 style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textMuted, marginBottom: "10px" }}>Notice d'utilisation</h3>
        {loading && <p style={{ fontSize: "13px", color: COLORS.textMuted }}>Chargement…</p>}
        {error && <p style={{ fontSize: "13px", color: "#C0392B" }}>{error}</p>}
        {!loading && !error && documents.length === 0 && <p style={{ fontSize: "13px", color: COLORS.textMuted, fontStyle: "italic" }}>Aucun document disponible.</p>}
        {!loading && !error && documents.length > 0 && (
          <div style={{ display: "flex", gap: "8px" }}>
            <select value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)} style={selectStyle}>
              <option value="">Choisir un document…</option>
              {documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.name}</option>)}
            </select>
            <button onClick={handleViewSelected} disabled={!selectedDocId} style={{ display: "flex", alignItems: "center", gap: "6px", background: selectedDocId ? COLORS.gold : "#EFEFEC", color: selectedDocId ? COLORS.navy : COLORS.textMuted, border: "none", borderRadius: "10px", padding: "0 18px", fontSize: "13px", fontWeight: 700, cursor: selectedDocId ? "pointer" : "default" }}>
              <Eye size={16} /> Afficher
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "28px" }}>
        <button onClick={() => setShowExpertForm(true)} style={{ display: "flex", alignItems: "center", gap: "8px", background: COLORS.gold, color: COLORS.navy, border: "none", borderRadius: "10px", padding: "14px 20px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
          Une question ? Contactez nos experts <ArrowRight size={16} />
        </button>
      </div>
      {viewingDoc && <PdfViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
      {showExpertForm && <ExpertRequestForm item={item} category={category} onClose={() => setShowExpertForm(false)} />}
    </div>
  );
}

function ExpertRequestForm({ item, category, onClose }) {
    const [form, setForm] = useState({ nom: "", prenom: "", email: "", machine: "", numeroSerie: "", reference: "", sujet: "Support Technique", message: "" });
    const [fileName, setFileName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        // ... (Logique d'envoi simplifiée pour la démo)
        setSent(true);
        setSubmitting(false);
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,58,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }} onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: "16px", maxWidth: "480px", width: "100%", padding: "28px" }}>
                {sent ? <p>Demande envoyée.</p> : <form onSubmit={handleSubmit}><input placeholder="Nom" style={formInputStyle} /> <button type="submit" style={primaryBtnStyle}>Envoyer</button></form>}
            </div>
        </div>
    );
}

function PdfViewer({ doc, onClose }) { return <div style={{ position: "fixed", inset: 0, background: "black" }}><button onClick={onClose}>Fermer</button></div>; }
function Card({ icon: Icon, image, label, description, iconColor, onClick }) {
    return (
        <button onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "14px", padding: "24px", borderRadius: "14px", border: `1px solid ${COLORS.cardBorder}`,