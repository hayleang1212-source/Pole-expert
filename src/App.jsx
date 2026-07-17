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
  ArrowRight, Paperclip, Snowflake, Layers, SeparatorVertical, Filter, Waves, Droplets, ArrowDownToLine
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
import imgSigmaScb from "./assets/SCB.png";
import imgSigmaSc1 from "./assets/SC1.png";
import imgSigmaSc2 from "./assets/SC2.png";
import imgSigmaSc3 from "./assets/SC3.png";
import imgSigmaScm from "./assets/SCM.png";
import imgSecheurFrigorifique from "./assets/Sécheur frigorifique.png";
import imgSecheurAdsorption from "./assets/Sécheur adsorption.png";
import imgSecheurMembrane from "./assets/Sécheur à membrane.png";
import imgFiltration from "./assets/Filtration.png";
import imgVanneDhs from "./assets/Vanne DHS.png";
import imgAquamat from "./assets/Aquamat.png";
import imgPurgeur from "./assets/Purgeur.png";
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const DRIVE_API_KEY = "AIzaSyBCzsfVrBWSXSxS_5cVi0ESsQ7cqiNXtPg";

async function getDriveFiles(folderId, extension = null) {
  const listUrl = new URL("https://www.googleapis.com/drive/v3/files");
  // Construction dynamique de la requête : si extension est fournie, on filtre, sinon on prend tout
  // extension peut être une chaîne unique ("tgz") ou un tableau (["tgz", "zip"])
  let q = `'${folderId}' in parents and trashed=false`;
  if (extension) {
    const extensions = Array.isArray(extension) ? extension : [extension];
    const extQuery = extensions.map((ext) => `name contains '.${ext}'`).join(" or ");
    q += ` and (${extQuery})`;
  }
  
  listUrl.searchParams.set("q", q);
  listUrl.searchParams.set("fields", "files(id,name)");
  listUrl.searchParams.set("key", DRIVE_API_KEY);

  const res = await fetch(listUrl);
  if (!res.ok) throw new Error("Erreur API Drive");
  const data = await res.json();

  return (data.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    url: `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${DRIVE_API_KEY}`,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

async function getDriveDocuments(folderId) {
  return getDriveFiles(folderId, null);
}

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

const COLORS = {
  navy: "#0B1F3A",
  gold: "#F0AB00",
  goldDark: "#C98F00",
  bannerGray: "#7C8B8D",
  bg: "#FAFAF8",
  cardBorder: "#E7E7E3",
  textMuted: "#6B7280",
};

const SERVICE_EMAILS = {
  "Garantie": "garantie.france@kaeser.com",
  "Pièces détachées": "offres.france@kaeser.com",
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
          { id: "sc2-vis", label: "Compresseur SC2", icon: Settings, image: imgCompresseur, driveFolderId: "1QAyqki_IItZ6vOtf2EuADDKmKGbLkFkU" },
          { id: "sc3-vis", label: "Compresseur SC3", icon: Settings, image: imgCompresseur, driveFolderId: "19Z-TuSJgRa3Aq3btywU2AsdT746WJwtX" },
          { id: "scb-vis", label: "Compresseur SCB", icon: Settings, image: imgCompresseur, driveFolderId: "1PqDpXZQGdGXvwpV421WyY9scanMmCQhC" },
        ],
      },
      { id: "vis-seche", label: "Vis sèche", icon: Server, image: imgVisSeche },
      { id: "surpresseur-vis", label: "Surpresseur à vis", icon: Gauge, image: imgSurpresseur },
      { id: "mobilair", label: "Mobilair", icon: Truck, image: imgMobilair, driveFolderId: "18oDG68eFeXA_OV8LrHMFR6nnp4VpWYSO" },
      { id: "piston", label: "Piston", icon: Disc, image: imgPiston, driveFolderId: "1UG8Gd2Lb0682uhR1EltjOAU9tkhhjZMf", driveFolderIdCodesDefaut: "1_hhjsl7E6PT3mDCJXVatfG7aH-SFaPF-", driveFolderIdInstructionTechnique: "1bE65kkKKOElA86jFm82P7DDIaXI3-tpj" },
      {
        id: "traitement-air", label: "Traitement d'air", icon: Wind, image: imgTraitement,
        items: [
          { id: "secheur-frigorifique", label: "Sécheur frigorifique", icon: Snowflake, image: imgSecheurFrigorifique },
          { id: "secheur-adsorption", label: "Sécheur adsorption", icon: Layers, image: imgSecheurAdsorption },
          { id: "secheur-membrane", label: "Sécheur à membrane", icon: SeparatorVertical, image: imgSecheurMembrane },
          { id: "filtration", label: "Filtration", icon: Filter, image: imgFiltration },
          { id: "vanne-dhs", label: "Vanne DHS", icon: Waves, image: imgVanneDhs },
          { id: "aquamat", label: "AQUAMAT", icon: Droplets, image: imgAquamat },
          { id: "purgeur", label: "Purgeur", icon: ArrowDownToLine, image: imgPurgeur },
        ],
      },
      {
        id: "sigma-control", label: "Sigma Control", icon: MonitorSmartphone, image: imgSigmaControl,
        items: [
          { id: "sigma-scb", label: "SIGMA CONTROL BASIC", icon: MonitorSmartphone, image: imgSigmaScb, driveFolderIdCodesDefaut: "1Qhv79NL1RaAw-J1oR4uUbTfeqbjZmX7C", driveFolderIdInstructionTechnique: "1lrCFIdbOxnHZo5Mdtd7Ycs6k0xW-Zprj" },
          { id: "sigma-sc1", label: "SIGMA CONTROL 1", icon: MonitorSmartphone, image: imgSigmaSc1, driveFolderId: "1_-Y7puS8dMZDyAzzQwJkAHrOxvONsx50", driveFolderIdCommunication: "18y9gRyp4i12I6MUA32sbcf7qzL9eyreY" },
          { id: "sigma-sc2", label: "SIGMA CONTROL 2", icon: MonitorSmartphone, image: imgSigmaSc2, driveFolderId: "179_lD8DVt5RHBMxCEk28Szyeyz2iQ3qw", driveFolderIdCodesDefaut: "1mTt31_Kzc17wIWHVsQxay4aPi3IFvOxN", driveFolderIdCommunication: "1QjspPJ9dln1GzAMjzU0lK_9CrK82Sptn", driveFolderIdUpdate: "1hyQeeah1J_6qdSBz2YmI6qKkpGe7jGNw", driveFolderIdInstructionTechnique: "1VVNszF7ZH3bmjtGdZRfdmB20SHwFKUCa", simulateurUrl: "https://i0070916-p50100-c1-hc3fe5i5e5rdxznzctpjng5mx4sqx66dr.webdirect.mdex.de/index.html" },
          { id: "sigma-sc3", label: "SIGMA CONTROL 3", icon: MonitorSmartphone, image: imgSigmaSc3, driveFolderId: "1-idZVZsifWbGz3wViU0rABYiKTqkN6Lr", driveFolderIdCodesDefaut: "1PqOMKKr2GeUnIfp2DscllnaQ_L-NFU43", driveFolderIdCommunication: "1P2SxMX7nIoZoT2B1RpqsykVMoKORHffN", driveFolderIdInstructionTechnique: "1wQeZ3YZdmfTCyZ2bCMZC1Tj-o9ur0lzW", driveFolderIdUpdate: "1CtId3no7x1whbTIef05hE4y1LnvBSFgZ" },
          { id: "sigma-scm", label: "SIGMA CONTROL MOBILE", icon: MonitorSmartphone, image: imgSigmaScm, driveFolderId: "1lIhU9S5N4cSX5RBecrdROMwn7tHagZIi", driveFolderIdCodesDefaut: "12cBjWHm8gQ6mQPTwVZ83GgbPx4a0UE4X", driveFolderIdUpdate: "1Xh_sSns43pWKGi09Bf6hoae2vAyBuwzA", driveFolderIdInstructionTechnique: "1re_FkgT4jFWvPpZ97X8mcwqidJ6uGD-s" },
        ],
      },
      { id: "sam-40", label: "SAM 4.0", icon: Cpu, image: imgSAM },
      { id: "variateur", label: "Variateur", icon: SlidersHorizontal, image: imgVariateur },
      { id: "instruments", label: "Instruments", icon: Thermometer, image: imgInstruments },
      { id: "huile", label: "Huile", icon: Droplet, image: imgHuile, driveFolderIdInstructionTechnique: "1vD-kDI5DyKA6PQHMqgWtUgAJPo62Nfsu" },
      { id: "ada", label: "ADA", icon: Component, image: imgAda, driveFolderIdInstructionTechnique: "1UCzv0J4YNOG9Wvyu2GJFK1xllMK9TJ6n" },
      { id: "belimo", label: "BELIMO", icon: PlugZap, image: imgBelimo, driveFolderIdInstructionTechnique: "10NZSFUUzsV6fR5aY7mWqVivQDMaJjP63" },
    ],
  },
  {
    id: "garantie",
    label: "Garantie",
    description: "Enregistrements et demandes",
    icon: ShieldCheck,
    image: iconGarantie,
    items: [
      { id: "demande-garantie", label: "Demande garantie", icon: FileCheck },
      { id: "enregistrement-machine", label: "Enregistrement de la machine", icon: ClipboardList },
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

  const [stack, setStack] = useState([]);
  const push = (entry) => setStack((s) => [...s, entry]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const goHome = () => setStack([]);

  const current = stack[stack.length - 1];
  const activeCategory = stack.find((s) => s.type === "category")?.data;

  if (!authReady) return null;
  if (!user) {
    return <LoginScreen kickedOut={kickedOut} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.navy, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#FFC800", padding: "6px 24px 6px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", height: "72px", boxSizing: "border-box", position: "relative" }}>
        <img src={logo} alt="Kaeser Compresseurs" style={{ height: "100%", width: "auto", display: "block", background: "transparent", flexShrink: 0 }} />
        <h1 style={{ fontSize: "32px", fontWeight: 800, margin: 0, textAlign: "center", color: "#FFFFFF", position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", whiteSpace: "nowrap" }}>Le Pôle Expert</h1>
        <button onClick={() => signOut(auth)} style={{ fontSize: "13px", color: COLORS.navy, background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.15)", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", flexShrink: 0 }}>Se déconnecter ({user.email})</button>
      </div>
      <section style={{ background: COLORS.bannerGray, color: "#FFFFFF", padding: "0 24px 0 24px", display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
        <p style={{ fontStyle: "italic", fontSize: "14px", opacity: 0.9, margin: "10px 0 0", textAlign: "center" }}>Qualité, Performance et Satisfaction Client</p>
        <img src={imagePoleExpert} alt="Illustration Pôle Expert" style={{ display: "block", margin: "6px auto 0", height: "250px", width: "auto" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "14px", fontSize: "13.5px", opacity: 0.85, visibility: stack.length > 0 ? "visible" : "hidden" }}>
          <span style={{ cursor: "pointer" }} onClick={goHome}>Accueil</span>
          {stack.map((s, i) => {
            const isLast = i === stack.length - 1;
            return (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ opacity: 0.6 }}>/</span>
                <span style={{ cursor: isLast ? "default" : "pointer", opacity: 1, background: isLast ? COLORS.gold : "transparent", color: isLast ? COLORS.navy : "inherit", borderRadius: isLast ? "8px" : 0, padding: isLast ? "2px 10px" : 0 }} onClick={() => { if (!isLast) { setStack((prev) => prev.slice(0, i + 1)); } }}>{s.data.label}</span>
              </span>
            );
          })}
        </div>
      </section>
      <main style={{ flex: 1, padding: "12px 24px 40px" }}>
        {!current && <MainMenu onSelect={(cat) => push(cat.items ? { type: "category", data: cat } : { type: "item", data: cat })} />}
        {(current?.type === "category" || current?.type === "subcategory") && <SubMenu category={current.data} onSelect={(item) => push(item.items ? { type: "subcategory", data: item } : { type: "item", data: item })} />}
        {current?.type === "item" && <DetailPage category={stack[stack.length - 2]?.data} item={current.data} />}
      </main>
    </div>
  );
}

function MainMenu({ onSelect }) {
  return (
    <div style={gridStyle}>
      {CATEGORIES.map((cat) => (
        <Card key={cat.id} icon={cat.icon} image={cat.image} label={cat.label} description={cat.description} onClick={() => onSelect(cat)} />
      ))}
    </div>
  );
}

function SubMenu({ category, onSelect }) {
  const [query, setQuery] = useState("");
  const [showExpertForm, setShowExpertForm] = useState(false);
  const [showMachineForm, setShowMachineForm] = useState(false);
  const filteredItems = category.items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  const showSideIcon = category.id === "garantie" || category.id === "pieces-detachees" || category.id === "formation";

  const handleItemClick = (item) => {
    if (category.id === "garantie" && item.id === "demande-garantie") { setShowExpertForm(true); return; }
    if (category.id === "garantie" && item.id === "enregistrement-machine") { setShowMachineForm(true); return; }
    onSelect(item);
  };

  const content = (
    <>
      {category.searchable && (
        <div style={searchWrapStyle}>
          <Search size={18} color={COLORS.textMuted} />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher..." style={searchInputStyle} />
        </div>
      )}
      <div style={showSideIcon ? { display: "flex", flexWrap: "wrap", gap: "18px", justifyContent: "center" } : gridStyle}>
        {filteredItems.map((item) => (
          <Card 
            key={item.id} 
            icon={item.icon} 
            image={item.image} 
            label={item.label} 
            iconColor={category.itemIconColor} 
            onClick={() => handleItemClick(item)} 
            imageSize={item.id === "sigma-scm" ? 100 : undefined}
          />
        ))}
      </div>
      {category.searchable && filteredItems.length === 0 && <p style={{ color: COLORS.textMuted, fontSize: "14px" }}>Aucun résultat pour « {query} ».</p>}
    </>
  );

  return (
    <div>
      {showSideIcon ? (
        <div style={{ display: "flex", gap: "60px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "0 0 200px", textAlign: "center" }}>
            {category.image ? (
              <img src={category.image} alt="" style={{ width: 160, height: 160, objectFit: "contain", display: "block", margin: "0 auto" }} />
            ) : (
              <div style={{ display: "inline-flex", padding: "16px", borderRadius: "14px", background: "#FBF1D9" }}>
                <category.icon size={30} color={COLORS.gold} />
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: "280px" }}>{content}</div>
        </div>
      ) : (
        content
      )}
      {showExpertForm && <ExpertRequestForm item={null} category={category} initialSujet="Garantie" onClose={() => setShowExpertForm(false)} />}
      {showMachineForm && <MachineRegistrationForm category={category} onClose={() => setShowMachineForm(false)} />}
    </div>
  );
}

function DetailPage({ category, item }) {
  const [showExpertForm, setShowExpertForm] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  return (
    <div style={{ display: "flex", gap: "60px", flexWrap: "wrap", alignItems: "flex-start", maxWidth: "1200px" }}>
      <div style={{ flex: "0 0 300px" }}>
        {item.image ? (
          <img src={item.image} alt="" style={{ width: 200, height: 200, objectFit: "contain", marginBottom: "10px" }} />
        ) : (
          <div style={{ display: "inline-flex", padding: "16px", borderRadius: "14px", background: "#FBF1D9", marginBottom: "10px" }}>
            <item.icon size={30} color={COLORS.gold} />
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: "320px", maxWidth: "600px" }}>
        {item.id === "huile" ? (
          item.driveFolderIdInstructionTechnique && (
            <DocumentSection label="Fiche de sécurité" driveFolderId={item.driveFolderIdInstructionTechnique} localFolderId={`${item.id}/instruction-technique`} />
          )
        ) : (
          <>
            {item.driveFolderId && (
              <DocumentSection label="Notice d'utilisation" driveFolderId={item.driveFolderId} localFolderId={item.id} />
            )}
            {item.driveFolderIdCodesDefaut && (
              <DocumentSection label="Codes défaut" driveFolderId={item.driveFolderIdCodesDefaut} localFolderId={`${item.id}/codes-defaut`} />
            )}
            {item.driveFolderIdCommunication && (
              <DocumentSection label="Communication" driveFolderId={item.driveFolderIdCommunication} localFolderId={`${item.id}/communication`} forceDownload={true} />
            )}
            {item.driveFolderIdUpdate && (
              <DocumentSection label="Update" driveFolderId={item.driveFolderIdUpdate} localFolderId={`${item.id}/update`} fileExtension={["tgz", "zip"]} forceDownload={true} />
            )}
            {item.driveFolderIdInstructionTechnique && (
              <DocumentSection label="Instruction technique" driveFolderId={item.driveFolderIdInstructionTechnique} localFolderId={`${item.id}/instruction-technique`} />
            )}
          </>
        )}
        <div style={{ display: "flex", justifyContent: "flex-start", gap: "14px", flexWrap: "wrap", marginTop: "28px" }}>
          {item.simulateurUrl && (
            <button onClick={() => setShowSimulator(true)} style={{ display: "flex", alignItems: "center", gap: "8px", background: COLORS.navy, color: "#FFFFFF", border: "none", borderRadius: "10px", padding: "14px 20px", fontSize: "13px", fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", cursor: "pointer" }}>
              Simulateur SC 2
              <MonitorSmartphone size={16} />
            </button>
          )}
          <button onClick={() => setShowExpertForm(true)} style={{ display: "flex", alignItems: "center", gap: "8px", background: COLORS.gold, color: COLORS.navy, border: "none", borderRadius: "10px", padding: "14px 20px", fontSize: "13px", fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", cursor: "pointer" }}>
            Une question ? Contactez nos experts
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
      {showExpertForm && <ExpertRequestForm item={item} category={category} onClose={() => setShowExpertForm(false)} />}
      {showSimulator && <SimulatorViewer url={item.simulateurUrl} title="Simulateur SC 2" onClose={() => setShowSimulator(false)} />}
    </div>
  );
}

function SimulatorViewer({ url, title, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#FFFFFF", display: "flex", flexDirection: "column", zIndex: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: COLORS.navy, color: "#FFFFFF", flexShrink: 0 }}>
        <span style={{ fontSize: "14px", fontWeight: 600 }}>{title}</span>
        <button onClick={onClose} style={closeBtnStyle}><X size={16} />Fermer</button>
      </div>
      <iframe
        src={url}
        title={title}
        style={{ flex: 1, width: "100%", border: "none" }}
        allow="fullscreen"
      />
    </div>
  );
}

async function downloadFile(doc) {
  try {
    const res = await fetch(doc.url);
    if (!res.ok) throw new Error("Téléchargement impossible");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (e) {
    window.open(doc.url, "_blank");
  }
}

function DocumentSection({ label, driveFolderId, localFolderId, fileExtension = null, forceDownload = false }) {
  const localDocuments = useMemo(() => getLocalDocuments(localFolderId), [localFolderId]);
  const [driveDocuments, setDriveDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState("");

  useEffect(() => {
    if (!driveFolderId) return;
    setLoading(true);
    setError(null);
    getDriveFiles(driveFolderId, fileExtension)
      .then(setDriveDocuments)
      .catch(() => setError("Impossible de charger les documents depuis Drive."))
      .finally(() => setLoading(false));
  }, [driveFolderId, fileExtension]);

  const documents = driveFolderId ? driveDocuments : localDocuments;
  
  // On ne peut prévisualiser que les PDF, sauf si forceDownload est activé
  const handleViewSelected = () => {
    const doc = documents.find((d) => d.id === selectedDocId);
    if (!doc) return;
    
    // Vérifie si le fichier est un PDF pour la prévisualisation
    const isPdf = doc.name.toLowerCase().endsWith(".pdf");
    const isPreviewable = isPdf && !forceDownload;

    if (isPreviewable) {
      setViewingDoc(doc);
    } else {
      downloadFile(doc);
    }
  };

  return (
    <div style={{ marginTop: "22px" }}>
      <h3 style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textMuted, marginBottom: "10px" }}>{label}</h3>
      {loading && <p style={{ fontSize: "13px", color: COLORS.textMuted }}>Chargement…</p>}
      {error && <p style={{ fontSize: "13px", color: "#C0392B" }}>{error}</p>}
      {!loading && !error && documents.length === 0 && <p style={{ fontSize: "13px", color: COLORS.textMuted, fontStyle: "italic" }}>Aucun document disponible.</p>}
      {!loading && !error && documents.length > 0 && (
        <div style={{ display: "flex", gap: "8px" }}>
          <select value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)} style={selectStyle}>
            <option value="">Choisir un document…</option>
            {documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.name}</option>)}
          </select>
          <button onClick={handleViewSelected} disabled={!selectedDocId} style={{ display: "flex", alignItems: "center", gap: "6px", background: selectedDocId ? COLORS.gold : "#EFEFEC", color: selectedDocId ? COLORS.navy : COLORS.textMuted, border: "none", borderRadius: "10px", padding: "0 18px", fontSize: "13px", fontWeight: 700, cursor: selectedDocId ? "pointer" : "default", whiteSpace: "nowrap" }}>
            {selectedDocId && documents.find(d => d.id === selectedDocId)?.name.toLowerCase().endsWith(".pdf") && !forceDownload ? <Eye size={16} /> : <FileText size={16} />}
            {selectedDocId && documents.find(d => d.id === selectedDocId)?.name.toLowerCase().endsWith(".pdf") && !forceDownload ? "Afficher" : "Télécharger"}
          </button>
        </div>
      )}
      {viewingDoc && <PdfViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </div>
  );
}

function ExpertRequestForm({ item, category, onClose, initialSujet = "Support Technique" }) {
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", machine: "", numeroSerie: "", reference: "", sujet: initialSujet, message: "" });
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
      const destinataire = SERVICE_EMAILS[form.sujet] || null;
      await addDoc(collection(db, "expertRequests"), { ...form, destinataire, pieceJointeNom: fileName || null, produit: item?.label || category?.label || null, categorie: category?.label || null, requestedBy: auth.currentUser?.email || null, createdAt: serverTimestamp() });
      await fetch(APPS_SCRIPT_URL, {
        method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ ...form, destinataire, produit: item?.label || category?.label || "", categorie: category?.label || "", pieceJointe: fileName || "Aucune" }),
      });
      setSent(true);
    } catch {
      setError("Impossible d'envoyer votre demande pour l'instant. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,58,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: "16px", maxWidth: "480px", width: "100%", maxHeight: "90vh", overflow: "auto", padding: "28px", position: "relative" }}>
        <button onClick={onClose} aria-label="Fermer" style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted }}><X size={20} /></button>
        {sent ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px" }}>Demande envoyée</h2>
            <p style={{ color: COLORS.textMuted, fontSize: "14px", marginBottom: "20px" }}>Un expert vous répondra dans les meilleurs délais.</p>
            <button onClick={onClose} style={primaryBtnStyle}>Fermer</button>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "18px" }}>Nouvelle Demande d'Expertise</h2>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input required placeholder="Nom" value={form.nom} onChange={update("nom")} style={formInputStyle} />
              <input required placeholder="Prénom" value={form.prenom} onChange={update("prenom")} style={formInputStyle} />
              <input required type="email" placeholder="E-mail" value={form.email} onChange={update("email")} style={formInputStyle} />
              <FieldWithTooltip placeholder="Machine" value={form.machine} onChange={update("machine")} tooltip="Le modèle exact de la machine concernée (ex. CSDX SFC)." />
              <FieldWithTooltip placeholder="N° Série" value={form.numeroSerie} onChange={update("numeroSerie")} tooltip="Le numéro de série figure sur la plaque signalétique de la machine." />
              <FieldWithTooltip placeholder="Référence" value={form.reference} onChange={update("reference")} tooltip="Une référence interne de commande ou de dossier, si vous en avez une." />
              <select required value={form.sujet} onChange={update("sujet")} style={formInputStyle}>
                <option>Support Technique</option><option>Garantie</option><option>Pièces détachées</option><option>Formation</option>
              </select>
              <textarea required placeholder="Votre message..." value={form.message} onChange={update("message")} rows={4} style={{ ...formInputStyle, resize: "vertical", fontFamily: "inherit" }} />
              <div>
                <label style={{ fontSize: "12px", color: COLORS.textMuted, display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}><Paperclip size={14} />Pièce jointe (optionnel)</label>
                <input type="file" onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} style={{ fontSize: "13px" }} />
              </div>
              {error && <p style={{ color: "#C0392B", fontSize: "13px" }}>{error}</p>}
              <button type="submit" disabled={submitting} style={{ ...primaryBtnStyle, opacity: submitting ? 0.7 : 1, marginTop: "8px" }}>{submitting ? "Envoi…" : "Envoyer"}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function MachineRegistrationForm({ category, onClose }) {
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", clientFinal: "", adresse: "", machine: "", numeroSerie: "", reference: "", garantie: "", message: "" });
  const [ficheMiseEnRoute, setFicheMiseEnRoute] = useState("");
  const [photosInstallation, setPhotosInstallation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const destinataire = SERVICE_EMAILS[category?.label] || SERVICE_EMAILS["Garantie"];
      await addDoc(collection(db, "machineRegistrations"), { ...form, destinataire, ficheMiseEnRoute: ficheMiseEnRoute || null, photosInstallation: photosInstallation || null, categorie: category?.label || null, requestedBy: auth.currentUser?.email || null, createdAt: serverTimestamp() });
      await fetch(APPS_SCRIPT_URL, {
        method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ ...form, destinataire, type: "Enregistrement Machine", categorie: category?.label || "", ficheMiseEnRoute: ficheMiseEnRoute || "Aucune", photosInstallation: photosInstallation || "Aucune" }),
      });
      setSent(true);
    } catch {
      setError("Impossible d'envoyer votre demande pour l'instant. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,58,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: "16px", maxWidth: "480px", width: "100%", maxHeight: "90vh", overflow: "auto", padding: "28px", position: "relative" }}>
        <button onClick={onClose} aria-label="Fermer" style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted }}><X size={20} /></button>
        {sent ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px" }}>Machine enregistrée</h2>
            <p style={{ color: COLORS.textMuted, fontSize: "14px", marginBottom: "20px" }}>Votre enregistrement a bien été pris en compte.</p>
            <button onClick={onClose} style={primaryBtnStyle}>Fermer</button>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "18px" }}>Enregistrement Machine</h2>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input required placeholder="Nom" value={form.nom} onChange={update("nom")} style={formInputStyle} />
              <input required placeholder="Prénom" value={form.prenom} onChange={update("prenom")} style={formInputStyle} />
              <input required type="email" placeholder="E-mail" value={form.email} onChange={update("email")} style={formInputStyle} />
              <input required placeholder="Nom du client final" value={form.clientFinal} onChange={update("clientFinal")} style={formInputStyle} />
              <input required placeholder="Adresse postale" value={form.adresse} onChange={update("adresse")} style={formInputStyle} />
              <FieldWithTooltip placeholder="Machine" value={form.machine} onChange={update("machine")} tooltip="Le modèle exact de la machine concernée (ex. CSDX SFC)." />
              <FieldWithTooltip placeholder="N° Série" value={form.numeroSerie} onChange={update("numeroSerie")} tooltip="Le numéro de série figure sur la plaque signalétique de la machine." />
              <FieldWithTooltip placeholder="Référence" value={form.reference} onChange={update("reference")} tooltip="Une référence interne de commande ou de dossier, si vous en avez une." />
              <select required value={form.garantie} onChange={update("garantie")} style={formInputStyle}>
                <option value="" disabled>Garantie</option>
                <option>Garantie standard</option>
                <option>Garantie étendue</option>
              </select>
              <textarea placeholder="Votre message..." value={form.message} onChange={update("message")} rows={4} style={{ ...formInputStyle, resize: "vertical", fontFamily: "inherit" }} />
              <div>
                <label style={{ fontSize: "12px", color: COLORS.textMuted, display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Fiche mise en route</label>
                <input type="file" onChange={(e) => setFicheMiseEnRoute(e.target.files?.[0]?.name || "")} style={{ fontSize: "13px" }} />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: COLORS.textMuted, display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Photos d'installation</label>
                <input type="file" onChange={(e) => setPhotosInstallation(e.target.files?.[0]?.name || "")} style={{ fontSize: "13px" }} />
              </div>
              {error && <p style={{ color: "#C0392B", fontSize: "13px" }}>{error}</p>}
              <button type="submit" disabled={submitting} style={{ ...primaryBtnStyle, opacity: submitting ? 0.7 : 1, marginTop: "8px" }}>{submitting ? "Envoi…" : "Envoyer"}</button>
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
      <span title={tooltip} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: COLORS.textMuted, cursor: "help", display: "flex" }}><HelpCircle size={16} /></span>
    </div>
  );
}

const formInputStyle = { width: "100%", padding: "12px 14px", borderRadius: "8px", border: `1px solid ${COLORS.cardBorder}`, fontSize: "14px", outline: "none", boxSizing: "border-box" };
const primaryBtnStyle = { background: COLORS.gold, color: COLORS.navy, border: "none", borderRadius: "10px", padding: "14px 20px", fontSize: "13px", fontWeight: 700, cursor: "pointer" };

function PdfViewer({ doc, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [showOutline, setShowOutline] = useState(true);
  const [hasOutline, setHasOutline] = useState(true);
  const [rotation, setRotation] = useState(0);
  useEffect(() => { const block = (e) => e.preventDefault(); document.addEventListener("contextmenu", block); return () => document.removeEventListener("contextmenu", block); }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,58,0.85)", display: "flex", flexDirection: "column", zIndex: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: COLORS.navy, color: "#FFFFFF" }}>
        <span style={{ fontSize: "14px", fontWeight: 600 }}>{doc.name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button onClick={() => setShowOutline((s) => !s)} style={{ ...navBtnStyle, background: showOutline ? COLORS.gold : "rgba(255,255,255,0.15)" }} title="Signets"><PanelLeft size={16} color={showOutline ? COLORS.navy : "#FFFFFF"} /></button>
          {numPages && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
              <button onClick={() => setPageNumber((p) => Math.max(1, p - 1))} disabled={pageNumber <= 1} style={navBtnStyle}><ChevronLeft size={16} /></button>
              <span>Page {pageNumber} / {numPages}</span>
              <button onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages} style={navBtnStyle}><ChevronRight size={16} /></button>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={() => setRotation((r) => (r - 90 + 360) % 360)} style={navBtnStyle} title="Pivoter à gauche"><RotateCcw size={16} /></button>
            <button onClick={() => setRotation((r) => (r + 90) % 360)} style={navBtnStyle} title="Pivoter à droite"><RotateCw size={16} /></button>
          </div>
          <button onClick={onClose} style={closeBtnStyle}><X size={16} />Fermer</button>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Document file={doc.url} onLoadSuccess={(pdf) => setNumPages(pdf.numPages)} loading={<p style={{ color: "#FFFFFF", padding: "24px" }}>Chargement du document…</p>} error={<p style={{ color: "#FFFFFF", padding: "24px" }}>Impossible d'afficher ce PDF.</p>}>
          <div style={{ display: "flex", flex: 1, height: "100%" }}>
            {showOutline && (
              <div style={{ width: "260px", flexShrink: 0, overflow: "auto", background: "#FFFFFF", borderRight: `1px solid ${COLORS.cardBorder}`, padding: "16px" }}>
                <h4 style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textMuted, marginBottom: "10px" }}>Signets</h4>
                <div style={{ fontSize: "12px", lineHeight: 1.5 }}><Outline onLoadSuccess={(outline) => setHasOutline(Boolean(outline && outline.length))} onItemClick={({ pageNumber: pn }) => setPageNumber(pn)} /></div>
                {!hasOutline && <p style={{ fontSize: "12px", color: COLORS.textMuted }}>Ce PDF ne contient pas de signets.</p>}
              </div>
            )}
            <div onContextMenu={(e) => e.preventDefault()} style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: "24px", background: "#5A5A5A" }}>
              <Page pageNumber={pageNumber} rotate={rotation} renderAnnotationLayer={false} renderTextLayer={false} width={Math.min(1400, window.innerWidth - (showOutline ? 300 : 48))} />
            </div>
          </div>
        </Document>
      </div>
    </div>
  );
}

function Card({ icon: Icon, image, label, description, iconColor, onClick, imageSize }) {
  const imgSize = imageSize || (description ? 120 : 140);
  return (
    <button onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "14px", padding: description ? "22px 20px" : "20px 16px", borderRadius: "14px", border: `1px solid ${COLORS.cardBorder}`, background: "#FFFFFF", color: COLORS.navy, cursor: "pointer", boxShadow: "0 1px 3px rgba(11,31,58,0.04)", transition: "transform 0.15s ease, box-shadow 0.15s ease" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(11,31,58,0.08)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(11,31,58,0.04)"; }}>
      {image ? <img src={image} alt="" style={{ width: imgSize, height: imgSize, objectFit: "contain" }} /> : <Icon size={description ? 26 : 28} color={iconColor || COLORS.gold} strokeWidth={1.6} />}
      <div>
        <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "0.01em", textTransform: description ? "uppercase" : "none" }}>{label}</div>
        {description && <div style={{ fontSize: "12.5px", color: COLORS.textMuted, marginTop: "6px" }}>{description}</div>}
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
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (err) { setError(err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" ? "E-mail ou mot de passe incorrect." : "Impossible de se connecter."); }
    finally { setLoading(false); }
  };
  const handleForgotPassword = async () => {
    if (!email) { setError("Entrez votre e-mail."); return; }
    try { await sendPasswordResetEmail(auth, email); setResetSent(true); } catch { setError("Impossible d'envoyer l'e-mail."); }
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", background: COLORS.bg, padding: "20px" }}>
      <img src={logo} alt="Kaeser Compresseurs" style={{ height: "70px", width: "auto" }} />
      {kickedOut && <p style={alertStyle}>Vous avez été déconnecté(e) car ce compte a été utilisé sur un autre appareil.</p>}
      {resetSent && <p style={{ ...alertStyle, background: "#EAF7EE", color: "#1E7A34" }}>E-mail envoyé.</p>}
      {error && <p style={alertStyle}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", maxWidth: "320px" }}>
        <input type="email" placeholder="votre.email@kaeser.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
        <input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
        <button type="submit" disabled={loading} style={{ background: COLORS.gold, color: COLORS.navy, border: "none", borderRadius: "10px", padding: "14px 28px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>{loading ? "Connexion…" : "Se connecter"}</button>
      </form>
      <button onClick={handleForgotPassword} style={{ background: "none", border: "none", color: COLORS.textMuted, fontSize: "13px", cursor: "pointer", textDecoration: "underline" }}>Mot de passe oublié</button>
    </div>
  );
}

const alertStyle = { background: "#FBE9E7", color: "#C0392B", fontSize: "13px", padding: "10px 16px", borderRadius: "8px", maxWidth: "320px", textAlign: "center" };
const inputStyle = { padding: "12px 14px", borderRadius: "8px", border: `1px solid ${COLORS.cardBorder}`, fontSize: "14px", outline: "none" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 240px))", gap: "18px", maxWidth: "1560px", margin: "0 auto", justifyContent: "center" };
const searchWrapStyle = { display: "flex", alignItems: "center", gap: "10px", maxWidth: "480px", marginLeft: "auto", marginRight: "auto", marginBottom: "28px", padding: "12px 16px", borderRadius: "10px", border: `1px solid ${COLORS.cardBorder}`, background: "#FFFFFF" };
const searchInputStyle = { flex: 1, border: "none", outline: "none", fontSize: "14px", color: COLORS.navy, background: "transparent" };
const selectStyle = { width: "320px", flexShrink: 0, padding: "0 14px", height: "42px", borderRadius: "10px", border: `1px solid ${COLORS.cardBorder}`, background: "#FFFFFF", color: COLORS.navy, fontSize: "13px" };
const navBtnStyle = { display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.15)", border: "none", color: "#FFFFFF", cursor: "pointer", padding: "6px", borderRadius: "6px" };
const closeBtnStyle = { display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.15)", border: "none", color: "#FFFFFF", fontSize: "13px", cursor: "pointer", padding: "6px 12px", borderRadius: "8px" };