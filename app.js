import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// === CONFIGURATION FIREBASE ===
const firebaseConfig = {
    apiKey: "AIzaSyCrcApCqFrbC4Zom-wyu3q1QgMuMhirVAo",
    authDomain: "trackerpokemon.firebaseapp.com",
    projectId: "trackerpokemon",
    storageBucket: "trackerpokemon.firebasestorage.app",
    messagingSenderId: "956649261781",
    appId: "1:956649261781:web:56a13eff2dd0901377305c"
};

// Initialisation de Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let collectionData = [];
let modeVueActuel = localStorage.getItem('pokemonVue') || 'grille';

const form = document.getElementById('add-form');
const grid = document.getElementById('grid');
let monGraphique = null;
let portfolioChartInstance = null;
let categoryChartInstance = null;

function convertirDateEnObjet(strDate) {
    if (!strDate || strDate === "Achat / Début") return new Date(2025, 0, 1);
    const moisMap = {
        "janvier": 0, "février": 1, "mars": 2, "avril": 3, "mai": 4, "juin": 5,
        "juillet": 6, "août": 7, "septembre": 8, "octobre": 9, "novembre": 10, "décembre": 11
    };
    const parts = strDate.toLowerCase().split(' ');
    if (parts.length >= 2) {
        const m = moisMap[parts[0]] !== undefined ? moisMap[parts[0]] : 0;
        const a = parseInt(parts[1]) || 2026;
        return new Date(a, m, 1);
    }
    return new Date(2026, 0, 1);
}

window.addEventListener('DOMContentLoaded', async () => {
    const themeEnregistre = localStorage.getItem('pokemonTheme') || 'light';
    document.documentElement.setAttribute('data-theme', themeEnregistre);
    mettreAJourBoutonTheme(themeEnregistre);

    appliquerModeVueUI(modeVueActuel);

    const dateActuelle = new Date();
    const moisActuel = dateActuelle.toLocaleString('fr-FR', { month: 'long' });
    const anneeActuelle = dateActuelle.getFullYear().toString();

    const selectMois = document.getElementById('moisAchat-mois');
    const selectAnnee = document.getElementById('moisAchat-annee');
    const saisieMois = document.getElementById('saisie-globale-mois');
    const saisieAnnee = document.getElementById('saisie-globale-annee');

    if (selectMois) selectMois.value = moisActuel;
    if (selectAnnee && document.querySelector(`#moisAchat-annee option[value="${anneeActuelle}"]`)) selectAnnee.value = anneeActuelle;
    if (saisieMois) saisieMois.value = moisActuel;
    if (saisieAnnee && document.querySelector(`#saisie-globale-annee option[value="${anneeActuelle}"]`)) saisieAnnee.value = anneeActuelle;

    await chargerCollectionDepuisFirebase();
});

function basculerTheme() {
    const themeActuel = document.documentElement.getAttribute('data-theme');
    const nouveauTheme = themeActuel === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', nouveauTheme);
    localStorage.setItem('pokemonTheme', nouveauTheme);
    mettreAJourBoutonTheme(nouveauTheme);
    mettreAJourGraphiquesMacro();
}

function mettreAJourBoutonTheme(theme) {
    const bouton = document.getElementById('theme-toggle');
    if (bouton) {
        bouton.innerText = theme === 'dark' ? '☀️' : '🌙';
    }
}

function changerOnglet(nomOnglet, event) {
    document.querySelectorAll('.onglet-contenu').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

    const headerPrincipal = document.getElementById('header-principal');

    if (nomOnglet === 'vitrine') {
        document.getElementById('onglet-vitrine').style.display = 'flex';
        if (headerPrincipal) headerPrincipal.style.display = 'block';
    } else if (nomOnglet === 'dashboard') {
        document.getElementById('onglet-dashboard').style.display = 'block';
        if (headerPrincipal) headerPrincipal.style.display = 'none';
        mettreAJourGraphiquesMacro();
    }

    if (event && event.target) {
        event.target.classList.add('active');
    }
}

function changerVue(mode) {
    modeVueActuel = mode;
    localStorage.setItem('pokemonVue', mode);
    appliquerModeVueUI(mode);
    mettreAJourAffichage();
}

function appliquerModeVueUI(mode) {
    const btnGrille = document.getElementById('btn-vue-grille');
    const btnListe = document.getElementById('btn-vue-liste');
    if (btnGrille && btnListe) {
        if (mode === 'grille') {
            btnGrille.classList.add('active');
            btnListe.classList.remove('active');
            grid.className = 'grid';
        } else {
            btnListe.classList.add('active');
            btnGrille.classList.remove('active');
            grid.className = 'list-view-container';
        }
    }
}

async function chargerCollectionDepuisFirebase() {
    try {
        const querySnapshot = await getDocs(collection(db, "pokemonCollection"));
        collectionData = [];
        querySnapshot.forEach((docSnap) => {
            collectionData.push({ id: docSnap.id, ...docSnap.data() });
        });
        mettreAJourAffichage();
    } catch (error) {
        console.error("Erreur lors du chargement Firebase :", error);
    }
}

function mettreAJourAffichage() {
    grid.innerHTML = ''; 

    let sommeDepenseeGlobale = 0;
    let valeurCollectionGlobale = 0;

    const texteRecherche = document.getElementById('input-recherche') ? document.getElementById('input-recherche').value.toLowerCase().trim() : '';
    const triOption = document.getElementById('tri-option').value;

    collectionData.forEach(item => {
        const quantite = item.quantite || 1;
        sommeDepenseeGlobale += (item.prixAchat * quantite);
        valeurCollectionGlobale += (item.valeur * quantite);
    });

    let itemsAffiches = collectionData.map((item, originalIndex) => ({ ...item, originalIndex }));

    if (texteRecherche !== '') {
        itemsAffiches = itemsAffiches.filter(item => 
            item.nom.toLowerCase().includes(texteRecherche) || 
            item.set.toLowerCase().includes(texteRecherche) ||
            (item.details && item.details.toLowerCase().includes(texteRecherche))
        );
    }

    itemsAffiches.sort((a, b) => {
        const plusValueA = (a.valeur - a.prixAchat) * (a.quantite || 1);
        const plusValueB = (b.valeur - b.prixAchat) * (b.quantite || 1);

        if (triOption === 'recent') return b.originalIndex - a.originalIndex;
        if (triOption === 'ancien') return a.originalIndex - b.originalIndex;
        if (triOption === 'cher') return b.valeur - a.valeur;
        if (triOption === 'moins-cher') return a.valeur - b.valeur;
        if (triOption === 'plus-rentable') return plusValueB - plusValueA;
        if (triOption === 'moins-rentable') return plusValueA - plusValueB;
        if (triOption === 'categorie') return a.nom.localeCompare(b.nom);
        if (triOption === 'alphabetique') return a.set.localeCompare(b.set);
        return 0;
    });

    if (itemsAffiches.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">Aucun item trouvé.</div>`;
    }

    itemsAffiches.forEach((item) => {
        const index = item.originalIndex;
        const firestoreId = item.id;
        const quantite = item.quantite || 1; 

        if (!item.historique) {
            item.historique = [{ date: item.moisAchat || "Janvier 2026", valeur: item.valeur }];
        }

        const diffUnitaire = item.valeur - item.prixAchat;
        const differenceTotale = diffUnitaire * quantite;
        const couleurDiff = differenceTotale >= 0 ? 'profit' : 'loss';
        const signe = differenceTotale >= 0 ? '+' : '';
        
        const roiItem = item.prixAchat > 0 ? ((item.valeur - item.prixAchat) / item.prixAchat) * 100 : 0;
        const signeRoi = roiItem >= 0 ? '+' : '';
        const tendanceClass = roiItem >= 0 ? 'trend-badge profit' : 'trend-badge loss';
        const tendanceIcon = roiItem >= 0 ? '↗' : '↘';

        const boutonCardmarket = item.lienCardmarket 
            ? `<a href="${item.lienCardmarket}" target="_blank" class="btn-cardmarket" style="background-color: #0071e3; color: white;" onclick="event.stopPropagation()">Cardmarket</a>` 
            : '';

        const detailsHtml = item.details ? `<p class="card-details-sub" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: -4px; margin-bottom: 8px; font-weight: 500;">${item.details}</p>` : '';

        if (modeVueActuel === 'grille') {
            const card = document.createElement('div');
            card.className = 'card';
            card.onclick = () => ouvrirGraphique(index);

            card.innerHTML = `
                <div style="position: relative;">
                    <img src="${item.image}" alt="${item.nom}" class="card-image">
                    <span class="${tendanceClass}">${tendanceIcon} ${signeRoi}${roiItem.toFixed(1)}%</span>
                    <button class="btn-ajout-rapide-card" onclick="event.stopPropagation(); ouvrirModalAjoutStock('${firestoreId}')" title="Ajouter un exemplaire">+</button>
                </div>
                <div class="card-body">
                    <h3>${quantite}x ${item.nom}</h3>
                    <p class="card-set">${item.set}</p>
                    ${detailsHtml}
                    <div class="card-details">
                        <p>Achat moy. : <strong>${item.prixAchat} €</strong></p>
                        <p>Valeur : <span class="price-tag">${item.valeur} €</span></p>
                    </div>
                    <p class="card-profit ${couleurDiff}">Plus-value : ${signe}${differenceTotale.toFixed(2)} €</p>
                    <div class="card-actions" onclick="event.stopPropagation()">
                        ${boutonCardmarket}
                        <button onclick="ouvrirModification('${firestoreId}')" class="btn-modifier">Modifier</button>
                        <button onclick="supprimerItem('${firestoreId}')" class="btn-supprimer">Supprimer</button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        } else {
            const row = document.createElement('div');
            row.className = 'list-item-row';
            row.onclick = () => ouvrirGraphique(index);

            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px; flex: 2; min-width: 200px;">
                    <img src="${item.image}" alt="${item.nom}" style="width: 45px; height: 45px; object-fit: contain; background: var(--input-bg); border-radius: 8px; padding: 2px;">
                    <div>
                        <strong style="font-size: 0.95rem; display: block; color: var(--text-color);">${quantite}x ${item.nom}</strong>
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">${item.set} ${item.details ? '• ' + item.details : ''}</span>
                    </div>
                </div>
                <div style="flex: 1; text-align: center;">
                    <span style="font-size: 0.9rem; color: var(--text-secondary);">Achat moy. : <strong>${item.prixAchat} €</strong></span>
                </div>
                <div style="flex: 1; text-align: center;">
                    <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-color);">Valeur : ${item.valeur} €</span>
                </div>
                <div style="flex: 1; text-align: center;">
                    <span class="${couleurDiff}" style="font-weight: 600; font-size: 0.9rem;">${signe}${differenceTotale.toFixed(2)} €</span>
                </div>
                <div style="flex: 1; text-align: right; display: flex; gap: 5px; justify-content: flex-end;" onclick="event.stopPropagation()">
                    ${boutonCardmarket}
                    <button onclick="ouvrirModalAjoutStock('${firestoreId}')" class="btn-modifier" style="padding: 6px 10px; background: #34c759; color: white;" title="Ajouter un exemplaire">+</button>
                    <button onclick="ouvrirModification('${firestoreId}')" class="btn-modifier" style="padding: 6px 12px;">Modifier</button>
                    <button onclick="supprimerItem('${firestoreId}')" class="btn-supprimer" style="padding: 6px 12px;">Supprimer</button>
                </div>
            `;
            grid.appendChild(row);
        }
    });

    const plusValueGlobale = valeurCollectionGlobale - sommeDepenseeGlobale;
    const roiGlobal = sommeDepenseeGlobale > 0 ? (plusValueGlobale / sommeDepenseeGlobale) * 100 : 0;
    
    document.getElementById('total-depense').innerText = sommeDepenseeGlobale.toFixed(2) + ' €';
    document.getElementById('total-valeur').innerText = valeurCollectionGlobale.toFixed(2) + ' €';
    
    const elPlusValue = document.getElementById('total-plusvalue');
    const signeGlobal = plusValueGlobale >= 0 ? '+' : '';
    elPlusValue.innerText = signeGlobal + plusValueGlobale.toFixed(2) + ' €';
    elPlusValue.className = 'stat-value ' + (plusValueGlobale >= 0 ? 'stat-profit-header' : 'stat-loss-header');

    const elDashboardRoi = document.getElementById('dashboard-total-roi');
    if (elDashboardRoi) {
        elDashboardRoi.innerText = (roiGlobal >= 0 ? '+' : '') + roiGlobal.toFixed(1) + '%';
        elDashboardRoi.className = 'dashboard-roi-value ' + (roiGlobal >= 0 ? 'stat-profit-header' : 'stat-loss-header');
    }

    mettreAJourGraphiquesMacro();
}

function mettreAJourGraphiquesMacro() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const couleurGrille = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f7';
    const couleurTexte = isDark ? '#98989f' : '#86868b';

    let toutesLesDatesSet = new Set();
    collectionData.forEach(item => {
        if (item.historique) {
            item.historique.forEach(h => toutesLesDatesSet.add(h.date));
        }
        if (item.moisAchat) {
            toutesLesDatesSet.add(item.moisAchat);
        }
        if (item.achatsDetail) {
            item.achatsDetail.forEach(a => toutesLesDatesSet.add(a.moisAchat));
        }
    });

    let labelsDates = Array.from(toutesLesDatesSet).sort((a, b) => convertirDateEnObjet(a) - convertirDateEnObjet(b));

    const periodeFiltre = document.getElementById('select-periode') ? document.getElementById('select-periode').value : 'tous';
    if (periodeFiltre !== 'tous' && labelsDates.length > parseInt(periodeFiltre)) {
        labelsDates = labelsDates.slice(-parseInt(periodeFiltre));
    }

    let dataValeursPortefeuille = [];
    let dataInvestissementMensuel = [];
    let tableauCorpsHtml = '';

    labelsDates.forEach(date => {
        const dateObjCourante = convertirDateEnObjet(date);

        let sommeInvestieMois = 0;
        collectionData.forEach(item => {
            if (item.achatsDetail && item.achatsDetail.length > 0) {
                item.achatsDetail.forEach(achat => {
                    const dateAchatItem = convertirDateEnObjet(achat.moisAchat);
                    if (dateAchatItem <= dateObjCourante) {
                        sommeInvestieMois += (achat.prixAchat * achat.quantite);
                    }
                });
            } else {
                const dateAchatItem = convertirDateEnObjet(item.moisAchat || "Janvier 2026");
                if (dateAchatItem <= dateObjCourante) {
                    sommeInvestieMois += (item.prixAchat * (item.quantite || 1));
                }
            }
        });

        let sommeValeurDate = 0;
        collectionData.forEach(item => {
            const quantite = item.quantite || 1;
            const pointH = item.historique ? item.historique.find(h => h.date === date) : null;
            if (pointH) {
                sommeValeurDate += pointH.valeur * quantite;
            } else {
                let dateReference = item.moisAchat || "Janvier 2026";
                if (item.achatsDetail && item.achatsDetail.length > 0) {
                    dateReference = item.achatsDetail[0].moisAchat;
                }
                const dateAchatItem = convertirDateEnObjet(dateReference);
                if (dateAchatItem <= dateObjCourante) {
                    sommeValeurDate += item.valeur * quantite;
                }
            }
        });

        dataValeursPortefeuille.push(sommeValeurDate);
        dataInvestissementMensuel.push(sommeInvestieMois);

        const plusValueMois = sommeValeurDate - sommeInvestieMois;
        const roiMois = sommeInvestieMois > 0 ? (plusValueMois / sommeInvestieMois) * 100 : 0;
        const signeMois = plusValueMois >= 0 ? '+' : '';
        const classeCouleur = plusValueMois >= 0 ? 'color: #34c759;' : 'color: #ff3b30;';

        tableauCorpsHtml += `
            <tr>
                <td><strong>${date}</strong></td>
                <td>${sommeInvestieMois.toFixed(2)} €</td>
                <td>${sommeValeurDate.toFixed(2)} €</td>
                <td style="${classeCouleur} font-weight: 600;">${signeMois}${plusValueMois.toFixed(2)} €</td>
                <td style="${classeCouleur} font-weight: 600;">${signeMois}${roiMois.toFixed(1)}%</td>
            </tr>
        `;
    });

    const tbody = document.getElementById('tableau-analytique-corps');
    if (tbody) {
        tbody.innerHTML = tableauCorpsHtml !== '' ? tableauCorpsHtml : `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">Aucune donnée disponible pour cette période.</td></tr>`;
    }

    const ctxPortfolio = document.getElementById('portfolioChart');
    if (ctxPortfolio) {
        if (portfolioChartInstance) portfolioChartInstance.destroy();

        portfolioChartInstance = new Chart(ctxPortfolio.getContext('2d'), {
            type: 'line',
            data: {
                labels: labelsDates.length > 0 ? labelsDates : ["Début"],
                datasets: [
                    {
                        label: 'Valorisation du Portefeuille (€)',
                        data: dataValeursPortefeuille.length > 0 ? dataValeursPortefeuille : [0],
                        borderColor: '#34c759',
                        backgroundColor: isDark ? 'rgba(52, 199, 89, 0.15)' : 'rgba(52, 199, 89, 0.08)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.3,
                        pointRadius: 4
                    },
                    {
                        label: 'Capital Investi (€)',
                        data: dataInvestissementMensuel.length > 0 ? dataInvestissementMensuel : [0],
                        borderColor: '#0071e3',
                        backgroundColor: isDark ? 'rgba(0, 113, 227, 0.15)' : 'rgba(0, 113, 227, 0.08)',
                        borderWidth: 2.5,
                        fill: true,
                        tension: 0.1,
                        pointRadius: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: couleurGrille }, ticks: { color: couleurTexte } },
                    x: { grid: { display: false }, ticks: { color: couleurTexte } }
                },
                plugins: { legend: { labels: { color: couleurTexte }, position: 'top' } }
            }
        });
    }

    let categoriesMap = {};
    collectionData.forEach(item => {
        const cat = item.nom || 'Autre';
        const valTotale = item.valeur * (item.quantite || 1);
        categoriesMap[cat] = (categoriesMap[cat] || 0) + valTotale;
    });

    const catLabels = Object.keys(categoriesMap);
    const catData = Object.values(categoriesMap);

    const ctxCategory = document.getElementById('categoryChart');
    if (ctxCategory) {
        if (categoryChartInstance) categoryChartInstance.destroy();

        categoryChartInstance = new Chart(ctxCategory.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: catLabels.length > 0 ? catLabels : ['Aucun item'],
                datasets: [{
                    data: catData.length > 0 ? catData : [1],
                    backgroundColor: ['#0071e3', '#34c759', '#ff9500', '#af52de', '#ff2d55', '#5856d6', '#5ac8fa', '#ffcc00']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: couleurTexte } }
                }
            }
        });
    }
}

form.addEventListener('submit', function(e) {
    e.preventDefault(); 
    const imageInput = document.getElementById('imageInput');
    const file = imageInput.files[0];

    if (!file) {
        alert("Veuillez sélectionner une image.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(event) {
        try {
            const nomSaisi = document.getElementById('nom').value.trim();
            const setSaisi = (document.getElementById('set').value || "").trim().toLowerCase();
            const detailsSaisi = (document.getElementById('details').value || "").trim().toLowerCase();
            const quantiteAjoutee = parseInt(document.getElementById('quantite').value) || 1;
            const prixAchatAjoute = parseFloat(document.getElementById('prixAchat').value) || 0;
            const valeurActuelleSaisie = parseFloat(document.getElementById('valeur').value) || 0;
            
            const moisStr = document.getElementById('moisAchat-mois').value;
            const anneeStr = document.getElementById('moisAchat-annee').value;
            const moisAchatSaisi = `${moisStr.charAt(0).toUpperCase() + moisStr.slice(1)} ${anneeStr}`;

            const indexExistant = collectionData.findIndex(item => 
                (item.nom || "").toLowerCase() === nomSaisi.toLowerCase() && 
                (item.set || "").toLowerCase() === setSaisi &&
                (item.details || "").trim().toLowerCase() === detailsSaisi
            );

            if (indexExistant !== -1) {
                let itemExistant = collectionData[indexExistant];
                const ancienneQuantite = itemExistant.quantite || 1;
                const ancienPrixMoyen = itemExistant.prixAchat || 0;
                const nouvelleQuantiteTotale = ancienneQuantite + quantiteAjoutee;
                
                const nouveauPrixMoyen = ((ancienPrixMoyen * ancienneQuantite) + (prixAchatAjoute * quantiteAjoutee)) / nouvelleQuantiteTotale;

                itemExistant.quantite = nouvelleQuantiteTotale;
                itemExistant.prixAchat = parseFloat(nouveauPrixMoyen.toFixed(2));
                itemExistant.valeur = valeurActuelleSaisie;

                if (!itemExistant.achatsDetail) {
                    itemExistant.achatsDetail = [{ quantite: ancienneQuantite, prixAchat: ancienPrixMoyen, moisAchat: itemExistant.moisAchat || moisAchatSaisi }];
                }
                itemExistant.achatsDetail.push({ quantite: quantiteAjoutee, prixAchat: prixAchatAjoute, moisAchat: moisAchatSaisi });

                if (!itemExistant.historique) itemExistant.historique = [];
                const pointH = itemExistant.historique.find(h => h.date.toLowerCase() === moisAchatSaisi.toLowerCase());
                if (pointH) {
                    pointH.valeur = valeurActuelleSaisie;
                } else {
                    itemExistant.historique.push({ date: moisAchatSaisi, valeur: valeurActuelleSaisie });
                }

                await updateDoc(doc(db, "pokemonCollection", itemExistant.id), {
                    quantite: itemExistant.quantite,
                    prixAchat: itemExistant.prixAchat,
                    valeur: itemExistant.valeur,
                    achatsDetail: itemExistant.achatsDetail,
                    historique: itemExistant.historique
                });

            } else {
                const nouvelItem = {
                    nom: nomSaisi,
                    set: document.getElementById('set').value.trim(),
                    details: (document.getElementById('details').value || "").trim(),
                    quantite: quantiteAjoutee,
                    prixAchat: prixAchatAjoute,
                    valeur: valeurActuelleSaisie,
                    moisAchat: moisAchatSaisi,
                    achatsDetail: [{ quantite: quantiteAjoutee, prixAchat: prixAchatAjoute, moisAchat: moisAchatSaisi }],
                    lienCardmarket: document.getElementById('lienCardmarket').value,
                    image: event.target.result,
                    historique: [{ date: moisAchatSaisi, valeur: valeurActuelleSaisie }]
                };

                const docRef = await addDoc(collection(db, "pokemonCollection"), nouvelItem);
                nouvelItem.id = docRef.id;
                collectionData.push(nouvelItem);
            }

            await chargerCollectionDepuisFirebase();
            form.reset(); 
            document.getElementById('quantite').value = 1; 
            
            const dateActuelle = new Date();
            document.getElementById('moisAchat-mois').value = dateActuelle.toLocaleString('fr-FR', { month: 'long' });
            document.getElementById('moisAchat-annee').value = dateActuelle.getFullYear().toString();
        } catch (err) {
            console.error("Erreur lors de l'ajout Firebase :", err);
            alert("Erreur lors de l'enregistrement de l'item.");
        }
    };
    reader.readAsDataURL(file);
});

window.ouvrirModalAjoutStock = function(firestoreId) {
    const item = collectionData.find(i => i.id === firestoreId);
    document.getElementById('stock-item-index').value = firestoreId;
    document.getElementById('titre-modal-stock').innerText = `Ajouter un exemplaire`;
    document.getElementById('sous-titre-modal-stock').innerText = `${item.nom} (${item.set})`;
    document.getElementById('stock-quantite').value = 1;
    document.getElementById('stock-prix').value = item.prixAchat;

    const dateActuelle = new Date();
    document.getElementById('stock-mois').value = dateActuelle.toLocaleString('fr-FR', { month: 'long' });
    document.getElementById('stock-annee').value = dateActuelle.getFullYear().toString();

    document.getElementById('modal-ajout-stock').style.display = 'flex';
}

window.fermerModalAjoutStock = function() {
    document.getElementById('modal-ajout-stock').style.display = 'none';
}

window.validerAjoutStock = async function(e) {
    e.preventDefault();
    const firestoreId = document.getElementById('stock-item-index').value;
    const quantiteAjoutee = parseInt(document.getElementById('stock-quantite').value);
    const prixAchatAjoute = parseFloat(document.getElementById('stock-prix').value);
    
    const moisStr = document.getElementById('stock-mois').value;
    const anneeStr = document.getElementById('stock-annee').value;
    const moisAchatSaisi = `${moisStr.charAt(0).toUpperCase() + moisStr.slice(1)} ${anneeStr}`;

    let item = collectionData.find(i => i.id === firestoreId);
    const ancienneQuantite = item.quantite || 1;
    const ancienPrixMoyen = item.prixAchat;
    const nouvelleQuantiteTotale = ancienneQuantite + quantiteAjoutee;

    const nouveauPrixMoyen = ((ancienPrixMoyen * ancienneQuantite) + (prixAchatAjoute * quantiteAjoutee)) / nouvelleQuantiteTotale;

    item.quantite = nouvelleQuantiteTotale;
    item.prixAchat = parseFloat(nouveauPrixMoyen.toFixed(2));

    if (!item.achatsDetail) {
        item.achatsDetail = [{ quantite: ancienneQuantite, prixAchat: ancienPrixMoyen, moisAchat: item.moisAchat || "Janvier 2026" }];
    }
    item.achatsDetail.push({ quantite: quantiteAjoutee, prixAchat: prixAchatAjoute, moisAchat: moisAchatSaisi });

    if (!item.historique) item.historique = [];
    const pointH = item.historique.find(h => h.date.toLowerCase() === moisAchatSaisi.toLowerCase());
    if (!pointH) {
        item.historique.push({ date: moisAchatSaisi, valeur: item.valeur });
    }

    await updateDoc(doc(db, "pokemonCollection", firestoreId), {
        quantite: item.quantite,
        prixAchat: item.prixAchat,
        achatsDetail: item.achatsDetail,
        historique: item.historique
    });

    fermerModalAjoutStock();
    await chargerCollectionDepuisFirebase();
}

window.ouvrirModification = function(firestoreId) {
    const item = collectionData.find(i => i.id === firestoreId);

    document.getElementById('edit-index').value = firestoreId;
    document.getElementById('edit-nom').value = item.nom;
    document.getElementById('edit-quantite').value = item.quantite;
    document.getElementById('edit-set').value = item.set;
    document.getElementById('edit-details').value = item.details || '';
    document.getElementById('edit-prixAchat').value = item.prixAchat;
    document.getElementById('edit-valeur').value = item.valeur;
    document.getElementById('edit-lienCardmarket').value = item.lienCardmarket || '';
    
    if (item.moisAchat) {
        const parts = item.moisAchat.split(' ');
        if (parts.length >= 2) {
            document.getElementById('edit-moisAchat-mois').value = parts[0].toLowerCase();
            document.getElementById('edit-moisAchat-annee').value = parts[1];
        }
    }

    document.getElementById('edit-imageInput').value = '';
    document.getElementById('modal-modification').style.display = 'flex';
}

window.fermerModification = function() {
    document.getElementById('modal-modification').style.display = 'none';
}

window.sauvegarderModificationItem = async function(e) {
    e.preventDefault();
    const firestoreId = document.getElementById('edit-index').value;
    const itemActuel = collectionData.find(i => i.id === firestoreId);
    const imageInputFile = document.getElementById('edit-imageInput').files[0];

    const moisModifStr = document.getElementById('edit-moisAchat-mois').value;
    const anneeModifStr = document.getElementById('edit-moisAchat-annee').value;
    const moisAchatModifie = `${moisModifStr.charAt(0).toUpperCase() + moisModifStr.slice(1)} ${anneeModifStr}`;

    const enregistrerDonnees = async (imageFinal) => {
        const donneesMaj = {
            nom: document.getElementById('edit-nom').value,
            quantite: parseInt(document.getElementById('edit-quantite').value),
            set: document.getElementById('edit-set').value,
            details: (document.getElementById('edit-details').value || "").trim(),
            prixAchat: parseFloat(document.getElementById('edit-prixAchat').value),
            valeur: parseFloat(document.getElementById('edit-valeur').value),
            moisAchat: moisAchatModifie,
            lienCardmarket: document.getElementById('edit-lienCardmarket').value,
            image: imageFinal
        };

        await updateDoc(doc(db, "pokemonCollection", firestoreId), donneesMaj);
        fermerModification();
        await chargerCollectionDepuisFirebase();
    };

    if (imageInputFile) {
        const reader = new FileReader();
        reader.onload = async function(event) {
            await enregistrerDonnees(event.target.result);
        };
        reader.readAsDataURL(imageInputFile);
    } else {
        await enregistrerDonnees(itemActuel.image);
    }
}

window.supprimerItem = async function(firestoreId) {
    if(confirm('Es-tu sûr de vouloir supprimer cet item ?')) {
        await deleteDoc(doc(db, "pokemonCollection", firestoreId));
        await chargerCollectionDepuisFirebase();
    }
}

window.ouvrirMiseAJourMoisGlobale = function() {
    if (collectionData.length === 0) {
        alert("Votre vitrine est vide pour le moment.");
        return;
    }

    const conteneur = document.getElementById('conteneur-saisie-liste');
    conteneur.innerHTML = '';

    collectionData.forEach((item) => {
        const ligne = document.createElement('div');
        ligne.className = 'saisie-item-ligne';
        
        const boutonCardmarketSaisie = item.lienCardmarket 
            ? `<a href="${item.lienCardmarket}" target="_blank" class="btn-cardmarket" style="background-color: #0071e3; color: white; padding: 6px 10px; font-size: 0.8rem; text-decoration: none; border-radius: 8px; display: inline-flex; align-items: center;" title="Ouvrir Cardmarket">CM</a>` 
            : '';

        const detailsTxt = item.details ? ` (${item.details})` : '';

        ligne.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; flex: 2;">
                <img src="${item.image}" alt="${item.nom}" style="width: 40px; height: 40px; object-fit: contain; background: var(--card-bg); border-radius: 6px; padding: 2px;">
                <div>
                    <strong style="font-size: 0.95rem; display: block; color: var(--text-color);">${item.quantite}x ${item.nom}</strong>
                    <span style="font-size: 0.8rem; color: var(--text-secondary);">${item.set}${detailsTxt} (Actuel : ${item.valeur} €)</span>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                ${boutonCardmarketSaisie}
                <div style="display: flex; align-items: center; gap: 5px;">
                    <input type="text" inputmode="decimal" value="${item.valeur}" data-id="${item.id}" class="input-prix-rapide" style="width: 110px; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-color); font-size: 0.95rem; font-weight: 600; text-align: right;" required>
                    <span style="font-size: 0.9rem; color: var(--text-secondary);">€</span>
                </div>
            </div>
        `;
        conteneur.appendChild(ligne);
    });

    document.getElementById('modal-saisie-rapide').style.display = 'flex';
}

window.fermerSaisieRapide = function() {
    document.getElementById('modal-saisie-rapide').style.display = 'none';
}

window.sauvegarderSaisieRapide = async function() {
    const moisStr = document.getElementById('saisie-globale-mois').value;
    const anneeStr = document.getElementById('saisie-globale-annee').value;
    const moisSaisi = `${moisStr.charAt(0).toUpperCase() + moisStr.slice(1)} ${anneeStr}`;

    const inputs = document.querySelectorAll('.input-prix-rapide');
    
    for (let input of inputs) {
        const firestoreId = input.getAttribute('data-id');
        const valeurNettoyee = input.value.replace(',', '.');
        const nouvelleValeur = parseFloat(valeurNettoyee);

        if (!isNaN(nouvelleValeur)) {
            const item = collectionData.find(i => i.id === firestoreId);
            if (!item.historique) item.historique = [];

            const indexExistant = item.historique.findIndex(h => h.date.toLowerCase() === moisSaisi.toLowerCase());
            if (indexExistant !== -1) {
                item.historique[indexExistant].valeur = nouvelleValeur;
            } else {
                item.historique.push({ date: moisSaisi, valeur: nouvelleValeur });
            }

            item.valeur = nouvelleValeur;

            await updateDoc(doc(db, "pokemonCollection", firestoreId), {
                valeur: item.valeur,
                historique: item.historique
            });
        }
    }

    await chargerCollectionDepuisFirebase();
    fermerSaisieRapide();
}

window.ouvrirGraphique = function(index) {
    const item = collectionData[index];
    const detailsTxt = item.details ? ` (${item.details})` : '';
    document.getElementById('titre-graphique').innerText = `Progression : ${item.nom} - ${item.set}${detailsTxt}`;
    document.getElementById('modal-item-index').value = index;
    
    const dateActuelle = new Date();
    document.getElementById('nouveau-mois').value = dateActuelle.toLocaleString('fr-FR', { month: 'long' });
    document.getElementById('nouveau-annee').value = dateActuelle.getFullYear().toString();
    document.getElementById('nouvelle-valeur-mois').value = item.valeur;

    const prixAchatMoyen = item.prixAchat;
    const valeurActuelle = item.valeur;
    const divPourcent = document.getElementById('evolution-pourcent');

    if (prixAchatMoyen > 0) {
        const diffPourcent = ((valeurActuelle - prixAchatMoyen) / prixAchatMoyen) * 100;
        const signe = diffPourcent >= 0 ? '+' : '';
        divPourcent.innerText = `${signe}${diffPourcent.toFixed(1)}%`;
        divPourcent.style.backgroundColor = diffPourcent >= 0 ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)';
        divPourcent.style.color = diffPourcent >= 0 ? '#34c759' : '#ff3b30';
    } else {
        divPourcent.innerText = '0%';
        divPourcent.style.backgroundColor = 'var(--stat-bg)';
        divPourcent.style.color = 'var(--text-color)';
    }

    document.getElementById('modal-graphique').style.display = 'flex';
    mettreAJourInterfaceGraphique(item, index);
}

function mettreAJourInterfaceGraphique(item, index) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const couleurGrille = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f7';
    const couleurTexte = isDark ? '#98989f' : '#86868b';

    if (!item.historique) {
        item.historique = [{ date: item.moisAchat || "Janvier 2026", valeur: item.valeur }];
    }

    const labels = item.historique.map(h => h.date);
    const data = item.historique.map(h => h.valeur);
    const ctx = document.getElementById('myChart').getContext('2d');

    if (monGraphique) {
        monGraphique.destroy();
    }

    const lignePrixAchatPlugin = {
        id: 'lignePrixAchat',
        beforeDraw: (chart) => {
            const { ctx, chartArea: { left, right }, scales: { y } } = chart;
            const prixAchat = item.prixAchat;
            const yCoord = y.getPixelForValue(prixAchat);

            if (yCoord >= chart.chartArea.top && yCoord <= chart.chartArea.bottom) {
                ctx.save();
                ctx.beginPath();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = '#ff3b30';
                ctx.setLineDash([4, 4]);
                ctx.moveTo(left, yCoord);
                ctx.lineTo(right, yCoord);
                ctx.stroke();

                ctx.fillStyle = '#ff3b30';
                ctx.font = '500 11px -apple-system, sans-serif';
                ctx.fillText(`Achat moy. : ${prixAchat} €`, left + 10, yCoord - 6);
                ctx.restore();
            }
        }
    };

    monGraphique = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Valeur unitaire (€)',
                data: data,
                borderColor: '#0071e3',
                backgroundColor: isDark ? 'rgba(0, 113, 227, 0.15)' : 'rgba(0, 113, 227, 0.08)',
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#0071e3',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: couleurGrille }, ticks: { color: couleurTexte } },
                x: { grid: { display: false }, ticks: { color: couleurTexte } }
            },
            plugins: { legend: { display: false } }
        },
        plugins: [lignePrixAchatPlugin]
    });

    const listeDiv = document.getElementById('liste-historique-mois');
    listeDiv.innerHTML = '';

    item.historique.forEach((h, hIndex) => {
        const ligne = document.createElement('div');
        ligne.className = 'historique-ligne';
        ligne.innerHTML = `
            <span><strong>${h.date}</strong> : ${h.valeur} €</span>
            <button onclick="supprimerMois('${item.id}', ${hIndex})" style="background: #ff3b30; color: white; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500;">Supprimer</button>
        `;
        listeDiv.appendChild(ligne);
    });
}

window.ajouterNouveauMois = async function(e) {
    e.preventDefault();
    const index = parseInt(document.getElementById('modal-item-index').value);
    const moisStr = document.getElementById('nouveau-mois').value;
    const anneeStr = document.getElementById('nouveau-annee').value;
    const moisSaisi = `${moisStr.charAt(0).toUpperCase() + moisStr.slice(1)} ${anneeStr}`;
    const valeur = parseFloat(document.getElementById('nouvelle-valeur-mois').value);

    const item = collectionData[index];
    if (!item.historique) item.historique = [];

    const indexExistant = item.historique.findIndex(h => h.date.toLowerCase() === moisSaisi.toLowerCase());
    if (indexExistant !== -1) {
        item.historique[indexExistant].valeur = valeur;
    } else {
        item.historique.push({ date: moisSaisi, valeur: valeur });
    }

    item.valeur = valeur;

    await updateDoc(doc(db, "pokemonCollection", item.id), {
        valeur: item.valeur,
        historique: item.historique
    });

    await chargerCollectionDepuisFirebase();
    ouvrirGraphique(index); 
    document.getElementById('nouvelle-valeur-mois').value = '';
}

window.supprimerMois = async function(firestoreId, moisIndex) {
    const item = collectionData.find(i => i.id === firestoreId);
    
    if (item.historique.length <= 1) {
        alert("Impossible de supprimer le dernier point d'historique.");
        return;
    }

    item.historique.splice(moisIndex, 1);
    item.valeur = item.historique[item.historique.length - 1].valeur;

    await updateDoc(doc(db, "pokemonCollection", firestoreId), {
        valeur: item.valeur,
        historique: item.historique
    });

    const indexLocal = collectionData.findIndex(i => i.id === firestoreId);
    await chargerCollectionDepuisFirebase();
    ouvrirGraphique(indexLocal);
}

window.fermerGraphique = function() {
    document.getElementById('modal-graphique').style.display = 'none';
}
