import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
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
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, arrayUnion, onSnapshot, serverTimestamp, addDoc, collection } from "firebase/firestore";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby5oFSTJJoltdT2Cq1iEyXQ92RHPTN3BOj-AYq4bIcxgwe73TRZtvNwtc4x0-5EhG2k1Q/exec";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 Mo

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1] || "");
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

// Envoie le fichier à l'Apps Script existant, qui l'enregistre dans un dossier
// Google Drive dédié et renvoie son URL de partage. Gratuit : utilise le quota
// Drive du compte Google propriétaire du script, pas de facturation Firebase.
async function uploadFileToDrive(file) {
  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error("Fichier trop volumineux (10 Mo maximum).");
  }
  const fileData = await fileToBase64(file);
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      type: "upload_piece_jointe",
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileData,
    }),
  });
  const data = await res.json();
  if (!data?.ok || !data?.fileUrl) throw new Error(data?.error || "Échec de l'upload.");
  return data.fileUrl;
}
import {
  Headset, ShieldCheck, Package, GraduationCap, ChevronLeft,
  FileCheck, RefreshCw, Clock,
  Search, PackageSearch, ClipboardList, BookOpen, Video, Award,
  FileText, Server, Wind, Gauge, Truck, Disc,
  MonitorSmartphone, Cpu, SlidersHorizontal, Thermometer, Droplet,
  Component, PlugZap, Eye, X, ChevronRight, PanelLeft, RotateCcw, RotateCw, Settings,
  ArrowRight, Paperclip, Snowflake, Layers, SeparatorVertical, Filter, Waves, Droplets, ArrowDownToLine, Bell,
  Archive, CheckCircle2, History, Inbox, Download, Send, Trash2
} from "lucide-react";

import logo from "./assets/logo-kaeser.png";
import imagePoleExpert from "./assets/image-pole-expert.png";
import iconSupportTechnique from "./assets/Support.png";
import iconGarantie from "./assets/Garantie.png";
import iconPiecesDetachees from "./assets/Pièces.png";
import iconFormation from "./assets/Formation.png";
import iconInfo from "./assets/Info.png";
import imgTooltipMachine from "./assets/Machine.png";
import imgTooltipNumeroSerie from "./assets/No série.png";
import imgTooltipReference from "./assets/Référence.png";
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
import imgSecheurHybritec from "./assets/Hybritec.png";
import imgSecheurCalorsec from "./assets/Calorsec.png";
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const DRIVE_API_KEY = "AIzaSyBCzsfVrBWSXSxS_5cVi0ESsQ7cqiNXtPg";

async function getDriveFiles(folderId, extension = null) {
  const listUrl = new URL("https://www.googleapis.com/drive/v3/files");
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

// --- Notifications de nouveaux documents PDF ---

const DRIVE_FOLDER_LABELS = {
  driveFolderId: "Notice d'utilisation",
  driveFolderIdCodesDefaut: "Codes défaut",
  driveFolderIdInstructionTechnique: "Instruction technique",
  driveFolderIdCommunication: "Communication",
  driveFolderIdUpdate: "Update",
  driveFolderIdServiceInstruction: "Service instruction",
  driveFolderIdInstructionMontage: "Instruction de montage",
};

function collectDriveFolderTargets(nodes, pathLabels = []) {
  let results = [];
  for (const node of nodes) {
    const newPath = node.label ? [...pathLabels, node.label] : pathLabels;
    for (const [key, docLabel] of Object.entries(DRIVE_FOLDER_LABELS)) {
      if (node[key]) {
        results.push({ folderId: node[key], context: `${newPath.join(" > ")} — ${docLabel}` });
      }
    }
    if (Array.isArray(node.items) && node.items.length) {
      results = results.concat(collectDriveFolderTargets(node.items, newPath));
    }
  }
  return results;
}

const PDF_SCAN_THROTTLE_MS = 15 * 60 * 1000; // ne relance un scan complet que toutes les 15 minutes

async function scanDriveForNewPdfNotifications(force = false) {
  const scanStateRef = doc(db, "appState", "pdfNotificationScan");

  let lastScanAt = 0;
  try {
    const scanStateSnap = await getDoc(scanStateRef);
    lastScanAt = scanStateSnap.exists() ? scanStateSnap.data()?.lastScanAt?.toMillis?.() || 0 : 0;
  } catch (err) {
    console.error("[pdfNotifications] Lecture de l'état du scan impossible — vérifiez les règles Firestore sur la collection 'appState'.", err);
    return { ok: false, reason: "read-scan-state-failed", error: err };
  }

  const now = Date.now();
  if (!force && now - lastScanAt < PDF_SCAN_THROTTLE_MS) {
    console.info(`[pdfNotifications] Scan ignoré : dernier scan il y a ${Math.round((now - lastScanAt) / 1000)}s (throttle 15 min). Utilisez force=true pour forcer.`);
    return { ok: true, skipped: true };
  }

  try {
    await setDoc(scanStateRef, { lastScanAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error("[pdfNotifications] Écriture de l'état du scan impossible — vérifiez les règles Firestore sur la collection 'appState'.", err);
    return { ok: false, reason: "write-scan-state-failed", error: err };
  }

  const targets = collectDriveFolderTargets(CATEGORIES);

  let existingSnap;
  try {
    existingSnap = await getDocs(collection(db, "pdfNotifications"));
  } catch (err) {
    console.error("[pdfNotifications] Lecture des notifications existantes impossible — vérifiez les règles Firestore sur la collection 'pdfNotifications'.", err);
    return { ok: false, reason: "read-notifications-failed", error: err };
  }
  const knownIds = new Set(existingSnap.docs.map((d) => d.id));

  let created = 0;
  let driveErrors = 0;
  let writeErrors = 0;

  for (const target of targets) {
    let files = [];
    try {
      files = await getDriveFiles(target.folderId, "pdf");
    } catch (err) {
      driveErrors++;
      console.warn(`[pdfNotifications] Erreur Drive sur le dossier ${target.folderId} (${target.context}) — vérifiez que le dossier est bien partagé publiquement et que la clé API Drive est valide.`, err);
      continue;
    }
    for (const file of files) {
      if (knownIds.has(file.id)) continue;
      knownIds.add(file.id);
      try {
        await setDoc(doc(db, "pdfNotifications", file.id), {
          fileName: file.name,
          fileUrl: file.url,
          folderId: target.folderId,
          context: target.context,
          createdAt: serverTimestamp(),
          validatedBy: [],
        });
        created++;
      } catch (err) {
        writeErrors++;
        console.error(`[pdfNotifications] Création de la notification impossible pour "${file.name}" — vérifiez les règles Firestore sur 'pdfNotifications'.`, err);
      }
    }
  }

  console.info(`[pdfNotifications] Scan terminé : ${targets.length} dossier(s) analysé(s), ${created} nouvelle(s) notification(s), ${driveErrors} erreur(s) Drive, ${writeErrors} erreur(s) Firestore.`);
  return { ok: true, created, driveErrors, writeErrors, foldersScanned: targets.length };
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

// Le statut administrateur est désormais déterminé par la présence d'un document
// dans la collection Firestore "admins" (id du document = e-mail de l'utilisateur).
// Voir isAdmin dans App() plus bas, et firestore.rules pour la sécurisation côté serveur.

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
          { id: "sc2-vis", label: "Compresseur SC2", icon: Settings, image: imgCompresseur, driveFolderId: "1QAyqki_IItZ6vOtf2EuADDKmKGbLkFkU",driveFolderIdCodesDefaut: "1mTt31_Kzc17wIWHVsQxay4aPi3IFvOxN",driveFolderIdInstructionTechnique: "1z83YLSzx3WrX8hdJ2I52rvwo-KOynPc3",driveFolderIdServiceInstruction: "1z83YLSzx3WrX8hdJ2I52rvwo-KOynPc3",driveFolderIdInstructionMontage: "12J6_w7WTsIQs8JcMmtnWYxMbPJDA9Y8X"
          },
          { id: "sc3-vis", label: "Compresseur SC3", icon: Settings, image: imgCompresseur, driveFolderId: "19Z-TuSJgRa3Aq3btywU2AsdT746WJwtX",driveFolderIdCodesDefaut: "1PqOMKKr2GeUnIfp2DscllnaQ_L-NFU43",driveFolderIdInstructionTechnique: "1z83YLSzx3WrX8hdJ2I52rvwo-KOynPc3",driveFolderIdServiceInstruction: "1z83YLSzx3WrX8hdJ2I52rvwo-KOynPc3", driveFolderIdInstructionMontage: "12J6_w7WTsIQs8JcMmtnWYxMbPJDA9Y8X"
               
          },
          { id: "scb-vis", label: "Compresseur SCB", icon: Settings, image: imgCompresseur, driveFolderId: "1PqDpXZQGdGXvwpV421WyY9scanMmCQhC",driveFolderIdCodesDefaut: "1Qhv79NL1RaAw-J1oR4uUbTfeqbjZmX7C",driveFolderIdInstructionTechnique: "1z83YLSzx3WrX8hdJ2I52rvwo-KOynPc3",driveFolderIdServiceInstruction: "1z83YLSzx3WrX8hdJ2I52rvwo-KOynPc3", driveFolderIdInstructionMontage: "12J6_w7WTsIQs8JcMmtnWYxMbPJDA9Y8X"
          
          },
        ],
      },
      { id: "vis-seche", label: "Vis sèche", icon: Server, image: imgVisSeche, driveFolderId: "1TDsbAxJXJ0k55rM7EbExljTInHqZCtbh", driveFolderIdCodesDefaut: "1YcFi78aP2YlWC8lw6zoki9gTdrfm9DOb" ,driveFolderIdInstructionTechnique: "1TTViFu40NERinMyqJFS2DJPU62giKX31",driveFolderIdServiceInstruction: "10s4eqnK0uvtQHDOvBR3S2dzvAwqPoom5", driveFolderIdInstructionMontage: "1PnUiU6CSE1N_fYuuC2PWvu3Fv0pBzswA"      
      },


      
      { id: "surpresseur-vis", label: "Surpresseur à vis", icon: Gauge, image: imgSurpresseur, driveFolderId: "1p8bsMe2iw688-mmNW9ea8uPZhrrLxNBV" ,driveFolderIdCodesDefaut: "1y5OppgzpaFjvC7Qq9iMgnamyot1x9h7k" ,driveFolderIdInstructionTechnique: "1u_YkofGRa2q_LS0RrqWPrYIWDIzvxLRd",driveFolderIdServiceInstruction: "1k5b50Pex_F2zS3rTClCpO_Dvdz9oq77o", driveFolderIdInstructionMontage: "1aMbCMW8g2cREDbNrtaMEEYI6GkmqpyUO"    
      },
      
      { id: "mobilair", label: "Mobilair", icon: Truck, image: imgMobilair, driveFolderId: "18oDG68eFeXA_OV8LrHMFR6nnp4VpWYSO",
  driveFolderIdCodesDefaut: "12cBjWHm8gQ6mQPTwVZ83GgbPx4a0UE4X" ,driveFolderIdInstructionTechnique: "1MDyufp0LGVIJNbgpjDeedK4TLvq2dOtf",driveFolderIdServiceInstruction: "1RIPmBkySMyq2K02JRq9nmAI5-7GNBRbH", driveFolderIdInstructionMontage: "17V1qV0uy_6R4G7T3pmzA-izRlm4pmqNw"       
      },
 
      { id: "piston", label: "Piston", icon: Disc, image: imgPiston, driveFolderId: "1UG8Gd2Lb0682uhR1EltjOAU9tkhhjZMf", driveFolderIdCodesDefaut: "1_hhjsl7E6PT3mDCJXVatfG7aH-SFaPF-", driveFolderIdInstructionTechnique: "1bE65kkKKOElA86jFm82P7DDIaXI3-tpj",driveFolderIdServiceInstruction: "1ZCMgH9iDGmb5FVKxxxVBtIsmEMPjXS0C", driveFolderIdInstructionMontage: "13aOt4_-F8cEzSaKDKRtrMFuS9ZcliumN" 
      },
      
      {
        id: "traitement-air", label: "Traitement d'air", icon: Wind, image: imgTraitement,
        items: [
          { id: "secheur-frigorifique", label: "Sécheur frigorifique", icon: Snowflake, image: imgSecheurFrigorifique,
          driveFolderId: "1DqiAzIuA7Tt37ZS0j-RqRu7fTdPLb11u",driveFolderIdCodesDefaut: "1-YSG7A-7eMCN8y-_5y_AvlezIJoEA-gr",driveFolderIdUpdate: "1pTe9MUDxUlcFNZ1Qo6Yo-Mua5Pce4LQx",driveFolderIdCommunication: "1LtNXgTccs0rEOPv89FJI_UkgAcV6uakw",driveFolderIdInstructionTechnique: "1ehJUSnuC3FIF2MtcdHWp_QaZg6DtSxPd",driveFolderIdServiceInstruction: "19WR5jrwLFO8pJUwB5gc2tmih1CEfhrIn", driveFolderIdInstructionMontage: "1zRor9rVeZHPk7mEFEpSSBhiHncvUxh2A"    
          },
          
          { id: "secheur-adsorption", label: "Sécheur adsorption", icon: Layers, image: imgSecheurAdsorption,
 driveFolderId: "1EEXnRK2rrG0P8p9Y9r4CL28LggEwytel",driveFolderIdUpdate: "1cgsVSfxvfp1D9LJqMI3rGvt23VU6lIfe",driveFolderIdCommunication: "14N4pqCXLQO5Lm55dEnCq2IIF46azUlDA",driveFolderIdInstructionTechnique: "1r35agCwTrMvD5UlE5L9y_TUAFEJDHxGF",driveFolderIdServiceInstruction: "187ZGxeUtv9y9KHASJC8Ziz0SFLiboT2X", driveFolderIdInstructionMontage: "18Hx0s23OUz0gdfWaB551xtutHgG5pSZ_"     
          },
          
          { id: "secheur-Calorsec", label: "Sécheur Calorsec", icon: Layers, image: imgSecheurCalorsec,driveFolderId: "1hrLiliSmWXYL0FLQx-EPcR8QpGkV-lNw",driveFolderIdInstructionTechnique: "11ok1zv1qAXhSF8dpRrZsz7K6VemwXZ1L",driveFolderIdServiceInstruction: "1G1HYEAD3BItkLEJxnpyC29ry_BgWNAmc", driveFolderIdInstructionMontage: "1aMbCMW8g2cREDbNrtaMEEYI6GkmqpyUO"     
          },
              
          { id: "secheur-Hybritec", label: "Sécheur Hybritec", icon: Layers, image: imgSecheurHybritec,driveFolderId: "1Tcdva_KsgIREt_hdhTA6AUY0h9uoNmm2",driveFolderIdInstructionTechnique: "1wpOx46onH3j0cDYxcPJ-VlaSHwSoaRm3",driveFolderIdServiceInstruction: "1h8evefbqvUs3Rv9TRZLjxp4IadMeUkEe", driveFolderIdInstructionMontage: "1s9FlSgFwvRI2V57fPcOMolS_nRLG7uRT"
          },
          
          { id: "secheur-membrane", label: "Sécheur à membrane", icon: SeparatorVertical, image: imgSecheurMembrane,driveFolderId: "1ZBp2QUqSn3WTaOIUs-XLmJxE6XuVc2Dw",driveFolderIdInstructionTechnique:"1aQrCcUS9MZznIqSTAoUd0HJXO1jH7hx-",driveFolderIdServiceInstruction: "1xbJyZpPWn37Sx7kXzbumoS9B-V0RX3EF", driveFolderIdInstructionMontage: "1XEwCnFivrSY1dpWAZQYHeZVMMWASNkt9"
          },
          
          { id: "filtration", label: "Filtration", icon: Filter, image: imgFiltration,driveFolderId: "1h8_lbyHTGtgyAuCg2hJeWjXx3Q5mUBOW",driveFolderIdInstructionTechnique:"1uY2qHgSGgV_XP9Hx3-z-le2o9vRzTr7t",driveFolderIdServiceInstruction: "16TZ4iZVI_6ChTCGEelY7MFPB6IrpvdUy",driveFolderIdServiceInstruction: "16TZ4iZVI_6ChTCGEelY7MFPB6IrpvdUy", driveFolderIdInstructionMontage: "1Jqp1EHnhHzesiEyc2MfGCNmpwtN-aIbQ"
          
          
          },
          { id: "vanne-dhs", label: "Vanne DHS", icon: Waves, image: imgVanneDhs,driveFolderId: "1nnJz39tLbHOIM8IsKyk-64XH4WmRSX6k",driveFolderIdUpdate: "1aQc-YqYy-AyKjB0uZiwa8AAKuaW4nG2G",driveFolderIdCommunication: "1TpuyK0F43JWDdQg0R8WE63anKa4QVDNX",driveFolderIdInstructionTechnique:"1C5djRMeStx4ZoUSMyojiMfV2nBWiwy7P",driveFolderIdServiceInstruction: "1AeM9f-ssDIt-T1_m1416hnYcxWAg2Owq", driveFolderIdInstructionMontage: "1gTaa-7u2b6OmG7b3BhzkALxYdZvFQsXZ"
          },
          
          { id: "aquamat", label: "AQUAMAT", icon: Droplets, image: imgAquamat,driveFolderId: "1Aa9AGQJGpx5zWieNKk1J1QXdM9-D09Wp",driveFolderIdCodesDefaut: "11iXVrjDu_bkA6bKH_srWm2JK6JVEoTeK",driveFolderIdInstructionTechnique:"1ahJBjKap0MJ5HLNogfOESpUS3eDAMKcZ",driveFolderIdServiceInstruction: "16TZ4iZVI_6ChTCGEelY7MFPB6IrpvdUy",driveFolderIdServiceInstruction: "1tI_cJdm25oHyHCaPQMHaIwPm359SPcGk", driveFolderIdInstructionMontage: "14Kzy5-91uEt2g-cyQUmKr82fn6xj8PVq"
          },
          
          { id: "purgeur", label: "Purgeur", icon: ArrowDownToLine, image: imgPurgeur,driveFolderId: "1PyTxu_ZoNfaDXJR9OeJo_YVohPyO9-Vj",driveFolderIdInstructionTechnique:"1NpPgubPIV6dLN1Qv-vAzgozk_X-pf-y4",driveFolderIdServiceInstruction: "16TZ4iZVI_6ChTCGEelY7MFPB6IrpvdUy",driveFolderIdServiceInstruction: "1ScDvRBnwXHBFX3hBmVPKyF1NHrLrwWCw", driveFolderIdInstructionMontage: "1ao5KgPXwolYtF5nqnn_1y_RyPALl7BEy"
          },

        { id: "instruments", label: "Instruments", icon: Thermometer, image: imgInstruments,driveFolderId: "1Hjuwji4E8ezY1HHAU7LYwNsJu0AYJFGf",driveFolderIdInstructionTechnique:"1dIgf3cx_mECwjPJCcrC81nR6MwxMUhBB",driveFolderIdServiceInstruction: "1NwhnTNzLdW5kKs351FHnLnyX9srKSQuw",driveFolderIdInstructionMontage: "1d25F_XIMg0CxN21nUHf6jI76Far-lvD_"
      },
      
        ],
      },
      {
        id: "sigma-control", label: "Sigma Control", icon: MonitorSmartphone, image: imgSigmaControl,
        items: [
          { id: "sigma-scb", label: "SIGMA CONTROL BASIC", icon: MonitorSmartphone, image: imgSigmaScb, driveFolderIdCodesDefaut: "1Qhv79NL1RaAw-J1oR4uUbTfeqbjZmX7C", driveFolderIdInstructionTechnique: "1lrCFIdbOxnHZo5Mdtd7Ycs6k0xW-Zprj" },
          { id: "sigma-sc1", label: "SIGMA CONTROL 1", icon: MonitorSmartphone, image: imgSigmaSc1, driveFolderId: "1_-Y7puS8dMZDyAzzQwJkAHrOxvONsx50", driveFolderIdCommunication: "18y9gRyp4i12I6MUA32sbcf7qzL9eyreY" },
          { id: "sigma-sc2", label: "SIGMA CONTROL 2", icon: MonitorSmartphone, image: imgSigmaSc2, driveFolderId: "179_lD8DVt5RHBMxCEk28Szyeyz2iQ3qw", driveFolderIdCodesDefaut: "1mTt31_Kzc17wIWHVsQxay4aPi3IFvOxN", driveFolderIdCommunication: "1QjspPJ9dln1GzAMjzU0lK_9CrK82Sptn", driveFolderIdUpdate: "1hyQeeah1J_6qdSBz2YmI6qKkpGe7jGNw", driveFolderIdInstructionTechnique: "1VVNszF7ZH3bmjtGdZRfdmB20SHwFKUCa", simulateurUrl: "https://i0070916-p50100-c1-hc3fe5i5e5rdxznzctpjng5mx4sqx66dr.webdirect.mdex.de/index.html", simulateurLabel: "Simulateur SC 2" },
          { id: "sigma-sc3", label: "SIGMA CONTROL 3", icon: MonitorSmartphone, image: imgSigmaSc3, driveFolderId: "1-idZVZsifWbGz3wViU0rABYiKTqkN6Lr", driveFolderIdCodesDefaut: "1PqOMKKr2GeUnIfp2DscllnaQ_L-NFU43", driveFolderIdCommunication: "1P2SxMX7nIoZoT2B1RpqsykVMoKORHffN", driveFolderIdInstructionTechnique: "1wQeZ3YZdmfTCyZ2bCMZC1Tj-o9ur0lzW", driveFolderIdUpdate: "1CtId3no7x1whbTIef05hE4y1LnvBSFgZ", simulateurUrl: "https://i0190606-guacamole.direct.mdex.de/guacamole/#/", simulateurLabel: "Simulateur SC 3", simulateurCredentials: { username: "KAESER-SC3", password: "SigmaControl3" } },
          { id: "sigma-scm", label: "SIGMA CONTROL MOBILE", icon: MonitorSmartphone, image: imgSigmaScm, driveFolderId: "1lIhU9S5N4cSX5RBecrdROMwn7tHagZIi", driveFolderIdCodesDefaut: "12cBjWHm8gQ6mQPTwVZ83GgbPx4a0UE4X", driveFolderIdUpdate: "1Xh_sSns43pWKGi09Bf6hoae2vAyBuwzA", driveFolderIdInstructionTechnique: "1re_FkgT4jFWvPpZ97X8mcwqidJ6uGD-s" },
        ],
      },
      { id: "sam-40", label: "SAM 4.0", icon: Cpu, image: imgSAM, driveFolderId: "1Aq-14EXHEXNX35RUfXHY_cXEsmjJTrGX",driveFolderIdCodesDefaut: "1qXwsn1pfuvIJOE9JMjm1tLFMI4b55Pnv",driveFolderIdUpdate: "1RHhF45uJrn4VLVUsCjnjVTdCWdJEK6jX",driveFolderIdCommunication: "1cbz_6HQzrAGVmH-llSKwaljOBhTAC8xO",driveFolderIdInstructionTechnique: "1JtRvY17NDOe_nazvceeOPYRR8BpuYTcM",driveFolderIdServiceInstruction: "1cQmyE9YnCdrUAkp26_7hFkIQnmYk9sV2", driveFolderIdInstructionMontage: "1xYAXNyoqDGzNtNUM7SGMj-CLJ1I0Lwm9"    
      
      
      },
      { id: "variateur", label: "Variateur", icon: SlidersHorizontal, image: imgVariateur,driveFolderId: "1C9I8HQCRiwkLC9ABb_n_BhVl4KmXarxy",driveFolderIdCodesDefaut: "194uOKt8oOGrYZ6pgKpC5TdAIzDrrrEd1",driveFolderIdInstructionTechnique: "1Un3FfzsZBSqLJndSJ-n5qbLGvnezLRqS",driveFolderIdServiceInstruction: "1xG5Kl7zkljhduCY78FlUqd1luuvM3jHN", driveFolderIdInstructionMontage: "1NQ7q2HayMobzMZEV3o50PJpwOYAM6ABZ"      
      },
           
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
    items: [],
  },
  {
    id: "formation",
    label: "Formation",
    description: "Modules experts",
    icon: GraduationCap,
    image: iconFormation,
    driveFolderId: "1jdNOxzb3yREl6X4yNpyxZGvhasujbymC",
    items: [],
  },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [kickedOut, setKickedOut] = useState(false);
  const [pdfNotifications, setPdfNotifications] = useState([]);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [scanningNotifs, setScanningNotifs] = useState(false);
  const autoOpenedNotifRef = useRef(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const firstLoginValidatedRef = useRef(false);
  const [expertRequests, setExpertRequests] = useState([]);
  const [showExpertRequestsModal, setShowExpertRequestsModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) setKickedOut(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user?.email) { setIsAdmin(false); return; }
    let cancelled = false;
    getDoc(doc(db, "admins", user.email))
      .then((snap) => { if (!cancelled) setIsAdmin(snap.exists()); })
      .catch(() => { if (!cancelled) setIsAdmin(false); });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    scanDriveForNewPdfNotifications();
    // Relance le scan périodiquement et quand l'utilisateur revient sur l'onglet,
    // pour détecter les PDF ajoutés pendant que l'app est déjà ouverte.
    const interval = setInterval(() => scanDriveForNewPdfNotifications(), 5 * 60 * 1000);
    const onVisibilityChange = () => { if (document.visibilityState === "visible") scanDriveForNewPdfNotifications(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const unsubscribe = onSnapshot(collection(db, "pdfNotifications"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setPdfNotifications(list);
    });
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      unsubscribe();
    };
  }, [user]);

  const handleForceScan = async () => {
    setScanningNotifs(true);
    const result = await scanDriveForNewPdfNotifications(true);
    setScanningNotifs(false);
    return result;
  };

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, "expertRequests"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setExpertRequests(list);
    });
    return unsubscribe;
  }, [user]);

  const visibleExpertRequests = useMemo(
    () => (isAdmin ? expertRequests : expertRequests.filter((r) => r.requestedBy === user?.email)),
    [expertRequests, isAdmin, user]
  );
  const pendingExpertRequestsCount = useMemo(
    () => visibleExpertRequests.filter((r) => !r.archived).length,
    [visibleExpertRequests]
  );

  const pendingNotifications = useMemo(
    () => pdfNotifications.filter((n) => !(n.validatedBy || []).includes(user?.email)),
    [pdfNotifications, user]
  );

  // À la toute première connexion d'un utilisateur (jamais connecté auparavant, quel que
  // soit l'appareil), on ne considère pas les documents déjà présents comme "nouveaux" :
  // ils sont marqués comme vus silencieusement, sans ouvrir la fenêtre de notification.
  // L'information est stockée côté serveur (Firestore), rattachée au compte utilisateur.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const userMetaRef = doc(db, "users", user.uid);
    getDoc(userMetaRef)
      .then((snap) => {
        if (cancelled) return;
        const alreadyHandled = snap.exists() && snap.data()?.pdfFirstLoginHandled;
        if (!alreadyHandled) {
          setIsFirstLogin(true);
          autoOpenedNotifRef.current = true; // empêche l'ouverture automatique du popup
          setDoc(userMetaRef, { pdfFirstLoginHandled: true }, { merge: true }).catch(() => {});
        }
      })
      .catch(() => {
        // En cas d'erreur de lecture, on n'active pas le mode "première connexion" :
        // le comportement normal (avec ouverture automatique si besoin) s'applique.
      });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!isFirstLogin || firstLoginValidatedRef.current || !user || pdfNotifications.length === 0) return;
    firstLoginValidatedRef.current = true;
    Promise.all(
      pdfNotifications
        .filter((n) => !(n.validatedBy || []).includes(user.email))
        .map((n) => updateDoc(doc(db, "pdfNotifications", n.id), { validatedBy: arrayUnion(user.email) }))
    ).catch(() => {});
  }, [isFirstLogin, pdfNotifications, user]);

  useEffect(() => {
    if (!autoOpenedNotifRef.current && pendingNotifications.length > 0) {
      setShowNotifModal(true);
      autoOpenedNotifRef.current = true;
    }
  }, [pendingNotifications.length]);

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
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <button onClick={() => setShowNotifModal(true)} aria-label="Notifications" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: "38px", height: "38px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.15)", borderRadius: "8px", cursor: "pointer", color: COLORS.navy }}>
            <Bell size={18} />
            {pendingNotifications.length > 0 && (
              <span style={{ position: "absolute", top: "-6px", right: "-6px", minWidth: "18px", height: "18px", padding: "0 4px", borderRadius: "9px", background: "#C0392B", color: "#FFFFFF", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{pendingNotifications.length}</span>
            )}
          </button>
          <button onClick={() => setShowExpertRequestsModal(true)} aria-label="Demandes experts" title="Demandes experts" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: "38px", height: "38px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.15)", borderRadius: "8px", cursor: "pointer", color: COLORS.navy }}>
            <ClipboardList size={18} />
            {pendingExpertRequestsCount > 0 && (
              <span style={{ position: "absolute", top: "-6px", right: "-6px", minWidth: "18px", height: "18px", padding: "0 4px", borderRadius: "9px", background: "#C0392B", color: "#FFFFFF", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{pendingExpertRequestsCount}</span>
            )}
          </button>
          <button onClick={() => signOut(auth)} style={{ fontSize: "13px", color: COLORS.navy, background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.15)", borderRadius: "8px", padding: "8px 14px", cursor: "pointer" }}>Se déconnecter ({user.email})</button>
        </div>
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
      {showNotifModal && (
        <PdfNotificationsModal
          notifications={pendingNotifications}
          currentUserEmail={user.email}
          onClose={() => setShowNotifModal(false)}
          onForceScan={handleForceScan}
          scanning={scanningNotifs}
        />
      )}
      {showExpertRequestsModal && (
        <ExpertRequestsModal
          requests={visibleExpertRequests}
          isAdmin={isAdmin}
          currentUserEmail={user.email}
          onClose={() => setShowExpertRequestsModal(false)}
        />
      )}
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
      {category.id === "formation" || category.id === "pieces-detachees" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          {category.id === "formation" && <FormationDocumentList driveFolderId={category.driveFolderId} />}
          <button onClick={() => setShowExpertForm(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: COLORS.gold, color: COLORS.navy, border: "none", borderRadius: "10px", padding: "14px 20px", fontSize: "13px", fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", cursor: "pointer", maxWidth: "480px" }}>
            {category.id === "formation" ? "CONTACTER LE SERVICE FORMATION" : "CONTACTER LE SERVICE PIECES"}
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <>
          <div style={showSideIcon ? { display: "flex", flexWrap: "wrap", gap: "18px", justifyContent: category.id === "garantie" ? "flex-start" : "center" } : gridStyle}>
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
          {category.id === "garantie" && (
            <button onClick={() => setShowExpertForm(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: COLORS.gold, color: COLORS.navy, border: "none", borderRadius: "10px", padding: "14px 20px", fontSize: "13px", fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", cursor: "pointer", maxWidth: "480px", marginTop: "22px" }}>
              CONTACTER LE SERVICE GARANTIE
              <ArrowRight size={16} />
            </button>
          )}
        </>
      )}
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
      {showExpertForm && <ExpertRequestForm item={null} category={category} initialSujet={category.id === "formation" ? "Formation" : category.id === "pieces-detachees" ? "Pièces détachées" : "Garantie"} onClose={() => setShowExpertForm(false)} />}
      {showMachineForm && <MachineRegistrationForm category={category} onClose={() => setShowMachineForm(false)} />}
    </div>
  );
}

function SimulateurButton({ item, onOpen }) {
  if (!item.simulateurUrl) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <button onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: "8px", background: COLORS.navy, color: "#FFFFFF", border: "none", borderRadius: "10px", padding: "14px 20px", fontSize: "13px", fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}>
        {item.simulateurLabel || "Simulateur"}
        <MonitorSmartphone size={16} />
      </button>
      {item.simulateurCredentials && (
        <div style={{ fontSize: "12.5px", color: COLORS.textMuted, lineHeight: 1.6 }}>
          <div>Username: {item.simulateurCredentials.username}</div>
          <div>Password: {item.simulateurCredentials.password}</div>
        </div>
      )}
    </div>
  );
}

function DetailPage({ category, item }) {
  const [showExpertForm, setShowExpertForm] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const simulateurInNoticeRow = Boolean(item.simulateurUrl && item.driveFolderId);
  return (
    <div style={{ display: "flex", gap: "60px", flexWrap: "wrap", alignItems: "flex-start", maxWidth: "1200px" }}>
      <div style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {item.image ? (
          <img src={item.image} alt="" style={{ width: 200, height: 200, objectFit: "contain", marginBottom: "10px" }} />
        ) : (
          <div style={{ display: "inline-flex", padding: "16px", borderRadius: "14px", background: "#FBF1D9", marginBottom: "10px" }}>
            <item.icon size={30} color={COLORS.gold} />
          </div>
        )}
        {simulateurInNoticeRow && (
          <div style={{ marginTop: "8px" }}>
            <SimulateurButton item={item} onOpen={() => setShowSimulator(true)} />
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
              <DocumentSection label="Update" driveFolderId={item.driveFolderIdUpdate} localFolderId={`${item.id}/update`} forceDownload={true} />
            )}
            {item.driveFolderIdInstructionTechnique && (
              <DocumentSection label="Instruction technique" driveFolderId={item.driveFolderIdInstructionTechnique} localFolderId={`${item.id}/instruction-technique`} />
            )}
            {item.driveFolderIdServiceInstruction && (
              <DocumentSection label="Service instruction" driveFolderId={item.driveFolderIdServiceInstruction} localFolderId={`${item.id}/service-instruction`} />
            )}
            {item.driveFolderIdInstructionMontage && (
              <DocumentSection label="Instruction de montage" driveFolderId={item.driveFolderIdInstructionMontage} localFolderId={`${item.id}/instruction-montage`} />
            )}
          </>
        )}
        <div style={{ display: "flex", justifyContent: "flex-start", gap: "14px", flexWrap: "wrap", marginTop: "28px" }}>
          {!simulateurInNoticeRow && <SimulateurButton item={item} onOpen={() => setShowSimulator(true)} />}
          <button onClick={() => setShowExpertForm(true)} style={{ display: "flex", alignItems: "center", gap: "8px", background: COLORS.gold, color: COLORS.navy, border: "none", borderRadius: "10px", padding: "14px 20px", fontSize: "13px", fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", cursor: "pointer" }}>
            Une question ? Contactez nos experts
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
      {showExpertForm && <ExpertRequestForm item={item} category={category} onClose={() => setShowExpertForm(false)} />}
      {showSimulator && <SimulatorViewer url={item.simulateurUrl} title={item.simulateurLabel || "Simulateur"} onClose={() => setShowSimulator(false)} />}
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

function CustomSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} style={{ position: "relative", ...selectStyle, padding: 0, display: "flex", alignItems: "center" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 14px", background: "transparent", border: "none", color: selected ? COLORS.navy : COLORS.textMuted,
          fontSize: "13px", cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected ? selected.label : placeholder}</span>
        <ChevronRight size={14} style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease", flexShrink: 0, marginLeft: "8px" }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: "260px", overflowY: "auto",
            background: "#FFFFFF", border: `1px solid ${COLORS.cardBorder}`, borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(11,31,58,0.15)", zIndex: 50,
          }}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                padding: "10px 14px", fontSize: "13px", cursor: "pointer", color: COLORS.navy,
                background: opt.value === value ? "#FBF1D9" : "transparent",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#FBF1D9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = opt.value === value ? "#FBF1D9" : "transparent"; }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormationDocumentList({ driveFolderId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);

  useEffect(() => {
    if (!driveFolderId) return;
    setLoading(true);
    setError(null);
    getDriveFiles(driveFolderId, "pdf")
      .then(setDocuments)
      .catch(() => setError("Impossible de charger les documents depuis Drive."))
      .finally(() => setLoading(false));
  }, [driveFolderId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "480px" }}>
      {loading && <p style={{ fontSize: "13px", color: COLORS.textMuted }}>Chargement…</p>}
      {error && <p style={{ fontSize: "13px", color: "#C0392B" }}>{error}</p>}
      {!loading && !error && documents.length === 0 && <p style={{ fontSize: "13px", color: COLORS.textMuted, fontStyle: "italic" }}>Aucun document disponible.</p>}
      {!loading && !error && documents.map((docItem) => (
        <button
          key={docItem.id}
          onClick={() => setViewingDoc(docItem)}
          style={{ display: "flex", alignItems: "center", gap: "10px", background: "#FFFFFF", border: `1px solid ${COLORS.cardBorder}`, borderRadius: "10px", padding: "12px 16px", fontSize: "13.5px", color: COLORS.navy, cursor: "pointer", textAlign: "left" }}
        >
          <FileText size={16} color={COLORS.gold} style={{ flexShrink: 0 }} />
          {docItem.name}
        </button>
      ))}
      {viewingDoc && <PdfViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </div>
  );
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
  
  const handleViewSelected = () => {
    const doc = documents.find((d) => d.id === selectedDocId);
    if (!doc) return;
    
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
          <CustomSelect
            value={selectedDocId}
            onChange={setSelectedDocId}
            placeholder="Choisir un document…"
            options={documents.map((doc) => ({ value: doc.id, label: doc.name }))}
          />
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
  const [file, setFile] = useState(null);
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
      let pieceJointeUrl = null;
      if (file) {
        pieceJointeUrl = await uploadFileToDrive(file);
      }
      const docRef = await addDoc(collection(db, "expertRequests"), { ...form, destinataire, pieceJointeNom: file?.name || null, pieceJointeUrl, produit: item?.label || category?.label || null, categorie: category?.label || null, requestedBy: auth.currentUser?.email || null, createdAt: serverTimestamp(), status: "En attente", archived: false });
      await fetch(APPS_SCRIPT_URL, {
        method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ type: "nouvelle_demande", requestId: docRef.id, ...form, destinataire, produit: item?.label || category?.label || "", categorie: category?.label || "", pieceJointe: file?.name || "Aucune" }),
      });
      setSent(true);
    } catch (err) {
      setError(err?.message && file ? `Pièce jointe : ${err.message}` : "Impossible d'envoyer votre demande pour l'instant. Réessayez.");
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
              <FieldWithTooltip placeholder="Machine" value={form.machine} onChange={update("machine")} tooltip="Le modèle exact de la machine concernée (ex. CSDX SFC)." tooltipImage={imgTooltipMachine} />
              <FieldWithTooltip placeholder="N° Série" value={form.numeroSerie} onChange={update("numeroSerie")} tooltip="Le numéro de série figure sur la plaque signalétique de la machine." tooltipImage={imgTooltipNumeroSerie} />
              <FieldWithTooltip placeholder="Référence" value={form.reference} onChange={update("reference")} tooltip="Une référence interne de commande ou de dossier, si vous en avez une." tooltipImage={imgTooltipReference} />
              <select required value={form.sujet} onChange={update("sujet")} style={formInputStyle}>
                <option>Support Technique</option><option>Garantie</option><option>Pièces détachées</option><option>Formation</option>
              </select>
              <textarea required placeholder="Votre message..." value={form.message} onChange={update("message")} rows={4} style={{ ...formInputStyle, resize: "vertical", fontFamily: "inherit" }} />
              <div>
                <label style={{ fontSize: "12px", color: COLORS.textMuted, display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}><Paperclip size={14} />Pièce jointe (optionnel)</label>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ fontSize: "13px" }} />
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
              <FieldWithTooltip placeholder="Machine" value={form.machine} onChange={update("machine")} tooltip="Le modèle exact de la machine concernée (ex. CSDX SFC)." tooltipImage={imgTooltipMachine} />
              <FieldWithTooltip placeholder="N° Série" value={form.numeroSerie} onChange={update("numeroSerie")} tooltip="Le numéro de série figure sur la plaque signalétique de la machine." tooltipImage={imgTooltipNumeroSerie} />
              <FieldWithTooltip placeholder="Référence" value={form.reference} onChange={update("reference")} tooltip="Une référence interne de commande ou de dossier, si vous en avez une." tooltipImage={imgTooltipReference} />
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

function FieldWithTooltip({ tooltip, tooltipImage, ...inputProps }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const iconRef = useRef(null);

  const handleEnter = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 8, left: rect.right });
    }
    setShowTooltip(true);
  };

  return (
    <div style={{ position: "relative" }}>
      <input required {...inputProps} style={{ ...formInputStyle, paddingRight: "36px" }} />
      <span
        ref={iconRef}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setShowTooltip(false)}
        style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", cursor: "help", display: "flex" }}
      >
        <img src={iconInfo} alt="Info" style={{ width: 16, height: 16 }} />
      </span>
      {showTooltip && tooltipImage && createPortal(
        <div style={{ position: "fixed", top: coords.top, left: coords.left, transform: "translateX(-100%)", zIndex: 9999, background: "#FFFFFF", border: `1px solid ${COLORS.cardBorder}`, borderRadius: "12px", padding: "12px", boxShadow: "0 16px 40px rgba(11,31,58,0.35)", pointerEvents: "none" }}>
          <img src={tooltipImage} alt={tooltip || ""} style={{ width: 380, maxWidth: "80vw", height: "auto", display: "block" }} />
        </div>,
        document.body
      )}
    </div>
  );
}

const formInputStyle = { width: "100%", padding: "12px 14px", borderRadius: "8px", border: `1px solid ${COLORS.cardBorder}`, fontSize: "14px", outline: "none", boxSizing: "border-box" };
const primaryBtnStyle = { background: COLORS.gold, color: COLORS.navy, border: "none", borderRadius: "10px", padding: "14px 20px", fontSize: "13px", fontWeight: 700, cursor: "pointer" };

function logDocumentConsultation(doc) {
  try {
    addDoc(collection(db, "documentConsultations"), {
      fileName: doc?.name || "Document inconnu",
      viewedBy: auth.currentUser?.email || null,
      viewedAt: serverTimestamp(),
    }).catch(() => {});
    fetch(APPS_SCRIPT_URL, {
      method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        type: "consultation_document",
        fileName: doc?.name || "Document inconnu",
        utilisateur: auth.currentUser?.email || "",
      }),
    }).catch(() => {});
  } catch {
    // La journalisation de la consultation ne doit jamais empêcher l'affichage du PDF.
  }
}

function PdfViewer({ doc, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [showOutline, setShowOutline] = useState(true);
  const [hasOutline, setHasOutline] = useState(true);
  const [rotation, setRotation] = useState(0);
  const consultationLoggedRef = useRef(false);
  useEffect(() => { const block = (e) => e.preventDefault(); document.addEventListener("contextmenu", block); return () => document.removeEventListener("contextmenu", block); }, []);
  useEffect(() => {
    if (consultationLoggedRef.current) return;
    consultationLoggedRef.current = true;
    logDocumentConsultation(doc);
  }, []);
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

function PdfNotificationsModal({ notifications, currentUserEmail, onClose, onForceScan, scanning }) {
  const [checked, setChecked] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [scanMessage, setScanMessage] = useState(null);

  const toggle = (id) => setChecked((c) => ({ ...c, [id]: !c[id] }));
  const selectedIds = Object.keys(checked).filter((id) => checked[id]);
  const allSelected = notifications.length > 0 && selectedIds.length === notifications.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setChecked({});
    } else {
      setChecked(Object.fromEntries(notifications.map((n) => [n.id, true])));
    }
  };

  const handleForceScan = async () => {
    setScanMessage(null);
    const result = await onForceScan();
    if (!result?.ok) {
      setScanMessage("La vérification a échoué. Ouvrez la console du navigateur (F12) pour voir le détail de l'erreur.");
    } else if (result.created > 0) {
      setScanMessage(`${result.created} nouveau(x) document(s) trouvé(s).`);
    } else {
      setScanMessage("Aucun nouveau document trouvé.");
    }
  };

  const validateIds = async (ids) => {
    if (ids.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await Promise.all(ids.map((id) => updateDoc(doc(db, "pdfNotifications", id), { validatedBy: arrayUnion(currentUserEmail) })));
      setChecked({});
    } catch {
      setError("Impossible d'enregistrer la validation pour l'instant. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,58,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: "16px", maxWidth: "560px", width: "100%", maxHeight: "85vh", overflow: "auto", padding: "28px", position: "relative" }}>
        <button onClick={onClose} aria-label="Fermer" style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted }}><X size={20} /></button>
        <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Bell size={20} color={COLORS.gold} />Nouveaux documents disponibles
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: notifications.length === 0 ? 0 : "4px" }}>
          <button onClick={handleForceScan} disabled={scanning} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: COLORS.goldDark, fontSize: "12.5px", fontWeight: 700, cursor: "pointer", padding: 0, opacity: scanning ? 0.6 : 1 }}>
            <RefreshCw size={13} />{scanning ? "Vérification…" : "Vérifier maintenant"}
          </button>
        </div>
        {scanMessage && <p style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "10px" }}>{scanMessage}</p>}
        {notifications.length === 0 ? (
          <>
            <p style={{ fontSize: "14px", color: COLORS.textMuted, marginTop: "16px" }}>Vous êtes à jour, aucune notification en attente.</p>
            <button onClick={onClose} style={{ ...primaryBtnStyle, marginTop: "18px" }}>Fermer</button>
          </>
        ) : (
          <>
            <p style={{ fontSize: "13px", color: COLORS.textMuted, marginBottom: "14px" }}>
              De nouveaux documents PDF ont été ajoutés. Cochez ceux dont vous avez pris connaissance puis validez : tant qu'un document n'est pas validé, il reste affiché ici.
            </p>
            {error && <p style={{ color: "#C0392B", fontSize: "13px", marginBottom: "10px" }}>{error}</p>}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
              <button onClick={() => validateIds(selectedIds)} disabled={submitting || selectedIds.length === 0} style={{ ...primaryBtnStyle, opacity: submitting || selectedIds.length === 0 ? 0.6 : 1 }}>
                {submitting ? "Validation…" : "Valider la sélection"}
              </button>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", marginBottom: "10px", borderRadius: "10px", background: "#FAFAF8", border: `1px solid ${COLORS.cardBorder}`, cursor: "pointer", fontSize: "13px", fontWeight: 700, color: COLORS.navy }}>
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
              Tout sélectionner ({notifications.length})
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "6px" }}>
              {notifications.map((n) => (
                <label key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px", borderRadius: "10px", border: `1px solid ${COLORS.cardBorder}`, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!checked[n.id]} onChange={() => toggle(n.id)} style={{ marginTop: "3px" }} />
                  <span>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13.5px", color: COLORS.navy }}>
                      <FileText size={14} color={COLORS.gold} />{n.fileName}
                    </span>
                    {n.context && <span style={{ display: "block", fontSize: "12px", color: COLORS.textMuted, marginTop: "2px" }}>{n.context}</span>}
                  </span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatRequestDate(ts) {
  const d = ts?.toDate?.();
  if (!d) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ExpertRequestCard({ request, isAdmin, onArchive, archiving }) {
  const isProcessed = !!request.archived;
  const [reponse, setReponse] = useState("");
  const canSend = reponse.trim().length > 0;
  return (
    <div style={{ padding: "14px 16px", borderRadius: "10px", border: `1px solid ${COLORS.cardBorder}`, background: isProcessed ? "#FAFAF8" : "#FFFFFF" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
        <div>
          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13.5px", color: COLORS.navy }}>
            <ClipboardList size={14} color={COLORS.gold} />{request.sujet || "Demande"}
          </span>
          <span style={{ display: "block", fontSize: "12px", color: COLORS.textMuted, marginTop: "2px" }}>
            {formatRequestDate(request.createdAt)}{request.produit ? ` — ${request.produit}` : ""}
          </span>
        </div>
        <span style={{
          fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap",
          background: isProcessed ? "#EAF7EE" : "#FFF4DE", color: isProcessed ? "#1E7A34" : COLORS.goldDark,
        }}>
          {isProcessed ? "Traitée" : "En attente"}
        </span>
      </div>
      <div style={{ marginTop: "10px", fontSize: "13px", color: COLORS.navy, display: "flex", flexDirection: "column", gap: "3px" }}>
        {isAdmin && <span><strong>Demandeur :</strong> {request.prenom} {request.nom} ({request.requestedBy || request.email})</span>}
        {request.machine && <span><strong>Machine :</strong> {request.machine}{request.numeroSerie ? ` — N° série ${request.numeroSerie}` : ""}</span>}
        {request.categorie && <span><strong>Catégorie :</strong> {request.categorie}</span>}
        {request.message && <span style={{ color: COLORS.textMuted, marginTop: "4px" }}>{request.message}</span>}
      </div>
      {request.pieceJointeUrl && (
        <a href={request.pieceJointeUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "10px", fontSize: "12.5px", fontWeight: 700, color: COLORS.goldDark, textDecoration: "none" }}>
          <Paperclip size={13} />{request.pieceJointeNom || "Pièce jointe"}<Download size={13} />
        </a>
      )}
      {isProcessed && (
        <>
          {request.reponse && (
            <div style={{ marginTop: "10px", padding: "10px 12px", borderRadius: "8px", background: "#FFFFFF", border: `1px solid ${COLORS.cardBorder}` }}>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: COLORS.textMuted }}>Réponse envoyée</span>
              <p style={{ fontSize: "13px", color: COLORS.navy, marginTop: "4px", whiteSpace: "pre-wrap" }}>{request.reponse}</p>
            </div>
          )}
          {request.processedAt && (
            <p style={{ fontSize: "11.5px", color: COLORS.textMuted, marginTop: "8px" }}>
              Traitée le {formatRequestDate(request.processedAt)}{request.processedBy ? ` par ${request.processedBy}` : ""}
            </p>
          )}
        </>
      )}
      {isAdmin && !isProcessed && (
        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: COLORS.textMuted }}>
            Réponse au demandeur
          </label>
          <textarea
            value={reponse}
            onChange={(e) => setReponse(e.target.value)}
            placeholder="Écrivez votre réponse, elle sera envoyée par e-mail au demandeur…"
            rows={3}
            style={{ ...formInputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
          <button
            onClick={() => onArchive(request, reponse.trim())}
            disabled={archiving || !canSend}
            title={!canSend ? "Écrivez une réponse avant de traiter la demande" : undefined}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: COLORS.navy, color: "#FFFFFF", border: "none", borderRadius: "8px", padding: "10px 14px", fontSize: "12.5px", fontWeight: 700, cursor: canSend ? "pointer" : "not-allowed", opacity: archiving || !canSend ? 0.6 : 1 }}
          >
            <Send size={14} />{archiving ? "Envoi…" : "Envoyer la réponse et marquer comme traitée"}
          </button>
        </div>
      )}
    </div>
  );
}

function ExpertRequestsModal({ requests, isAdmin, currentUserEmail, onClose }) {
  const [tab, setTab] = useState("active"); // "active" | "history"
  const [archivingId, setArchivingId] = useState(null);
  const [error, setError] = useState(null);
  const [clearing, setClearing] = useState(false);

  const activeRequests = requests.filter((r) => !r.archived);
  const archivedRequests = requests.filter((r) => r.archived);
  const list = tab === "active" ? activeRequests : archivedRequests;

  const handleClearHistory = async () => {
    if (archivedRequests.length === 0) return;
    const confirmed = window.confirm(
      `Effacer définitivement les ${archivedRequests.length} demande(s) de l'historique ? Cette action est irréversible.`
    );
    if (!confirmed) return;
    setError(null);
    setClearing(true);
    try {
      await Promise.all(archivedRequests.map((r) => deleteDoc(doc(db, "expertRequests", r.id))));
    } catch {
      setError("Impossible d'effacer l'historique pour l'instant. Réessayez.");
    } finally {
      setClearing(false);
    }
  };

  const handleArchive = async (request, reponse) => {
    setError(null);
    setArchivingId(request.id);
    try {
      await updateDoc(doc(db, "expertRequests", request.id), {
        archived: true,
        status: "Traitée",
        reponse,
        processedAt: serverTimestamp(),
        processedBy: currentUserEmail,
      });
      try {
        await fetch(APPS_SCRIPT_URL, {
          method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            type: "reponse_demande",
            requestId: request.id,
            email: request.email,
            nom: request.nom,
            prenom: request.prenom,
            sujet: request.sujet,
            produit: request.produit || "",
            machine: request.machine || "",
            messageOriginal: request.message || "",
            reponse,
            traitePar: currentUserEmail,
          }),
        });
      } catch {
        // La demande est bien marquée comme traitée même si l'envoi de l'e-mail échoue ;
        // on informe simplement l'admin que la notification n'est pas partie.
        setError("La demande a été traitée mais l'e-mail de réponse n'a pas pu être envoyé.");
      }
    } catch {
      setError("Impossible de mettre à jour la demande pour l'instant. Réessayez.");
    } finally {
      setArchivingId(null);
    }
  };

  const tabBtnStyle = (active) => ({
    display: "flex", alignItems: "center", gap: "6px", flex: 1, justifyContent: "center",
    padding: "9px 12px", borderRadius: "8px", border: "none", cursor: "pointer",
    fontSize: "12.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em",
    background: active ? COLORS.gold : "transparent", color: active ? COLORS.navy : COLORS.textMuted,
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,58,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: "16px", maxWidth: "640px", width: "100%", maxHeight: "85vh", overflow: "auto", padding: "28px", position: "relative" }}>
        <button onClick={onClose} aria-label="Fermer" style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted }}><X size={20} /></button>
        <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
          <ClipboardList size={20} color={COLORS.gold} />Demandes aux experts
        </h2>
        <p style={{ fontSize: "13px", color: COLORS.textMuted, marginBottom: "16px" }}>
          {isAdmin ? "Gérez les demandes en cours et consultez l'historique des demandes traitées." : "Suivez l'état de vos demandes et consultez votre historique."}
        </p>
        <div style={{ display: "flex", gap: "8px", background: "#FAFAF8", border: `1px solid ${COLORS.cardBorder}`, borderRadius: "10px", padding: "4px", marginBottom: "16px" }}>
          <button onClick={() => setTab("active")} style={tabBtnStyle(tab === "active")}>
            <Inbox size={14} />En cours ({activeRequests.length})
          </button>
          <button onClick={() => setTab("history")} style={tabBtnStyle(tab === "history")}>
            <History size={14} />Historique ({archivedRequests.length})
          </button>
        </div>
        {isAdmin && tab === "history" && archivedRequests.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
            <button
              onClick={handleClearHistory}
              disabled={clearing}
              style={{
                display: "flex", alignItems: "center", gap: "6px", background: "none", border: `1px solid #C0392B`,
                color: "#C0392B", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700,
                cursor: clearing ? "not-allowed" : "pointer", opacity: clearing ? 0.6 : 1,
              }}
            >
              <Trash2 size={13} />{clearing ? "Suppression…" : "Effacer l'historique"}
            </button>
          </div>
        )}
        {error && <p style={{ color: "#C0392B", fontSize: "13px", marginBottom: "10px" }}>{error}</p>}
        {list.length === 0 ? (
          <p style={{ fontSize: "14px", color: COLORS.textMuted, textAlign: "center", padding: "24px 0" }}>
            {tab === "active" ? "Aucune demande en cours." : "Aucune demande archivée pour le moment."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {list.map((r) => (
              <ExpertRequestCard key={r.id} request={r} isAdmin={isAdmin} onArchive={handleArchive} archiving={archivingId === r.id} />
            ))}
          </div>
        )}
      </div>
    </div>
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