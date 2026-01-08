const NORMAL_RANGES = {
  Homme: {
    creatinine: { min: 80, max: 115, unit: "mg/L" },
    hemoglobine: { min: 13, max: 17, unit: "g/dL" },
  },
  Femme: {
    creatinine: { min: 60, max: 100, unit: "mg/L" },
    hemoglobine: { min: 12, max: 16, unit: "g/dL" },
  },
  common: {
    poids: { min: 0, max: 999, unit: "kg" },
    frequence_urinaire: { min: 4, max: 7, unit: "fois/jour" },
    tension_systolique: { min: 100, max: 140, unit: "mmHg" },
    tension_diastolique: { min: 60, max: 90, unit: "mmHg" },
    frequence_cardiaque: { min: 60, max: 80, unit: "batt/min" },
    temperature: { min: 36.5, max: 37.5, unit: "°C" },
    glycemie: { min: 0.7, max: 1.0, unit: "g/L" },
    cholesterol: { min: 0, max: 2.0, unit: "g/L" },
    douleur_greffon: { min: 0, max: 4, unit: "/10" },
    tacrolimus: { min: 3, max: 7, unit: "ng/mL" },
    everolimus: { min: 3, max: 8, unit: "ng/mL" },
  },
}

const INFO_TEXTS = {
  poids: "Surveillance du poids pour détecter les variations hydriques. Une variation de ±3 kg nécessite une alerte",
  envie_uriner: "Permet d'évaluer la fonction de la vessie et l'état d'hydratation du patient",
  frequence: "Permet de détecter les troubles urinaires potentiels et les infections",
  frequence_urinaire:
    "Nombre de mictions par jour. Normal: 4-7 fois/jour. En dehors de cette plage peut indiquer une anomalie rénale ou infection",
  douleur_miction: "Permet d'identifier les infections ou inflammations des voies urinaires",
  douleur_greffon: "Permet de surveiller le rejet ou les complications du greffon rénal",
  maux_ventre: "Permet de détecter les complications digestives liées au traitement immunosuppresseur",
  diarrhee: "Effet secondaire fréquent des médicaments immunosuppresseurs, nécessite une surveillance",
  frissonnement: "Signe potentiel d'infection ou de fièvre, nécessite une attention particulière",
  creatinine:
    "Indicateur clé de la fonction rénale. Une valeur élevée indique une altération du débit de filtration glomérulaire",
  tension_systolique:
    "Surveillance cardiovasculaire essentielle en insuffisance rénale. L'hypertension aggrave la maladie rénale",
  tension_diastolique: "Complète la mesure de la tension artérielle pour une évaluation cardiovasculaire complète",
  frequence_cardiaque: "Surveillance du rythme cardiaque, important pour détecter les complications cardiovasculaires",
  temperature: "Détection précoce d'infections, particulièrement importante chez les patients immunodéprimés",
  glycemie:
    "Surveillance du diabète, effet secondaire possible des immunosuppresseurs. Le diabète aggrave l'insuffisance rénale",
  hemoglobine:
    "Détecte l'anémie, très fréquente en insuffisance rénale chronique due à la diminution de production d'érythropoïétine",
  cholesterol:
    "Surveillance des lipides, effet secondaire possible des immunosuppresseurs. L'hypercholestérolémie augmente le risque cardiovasculaire",
  tacrolimus:
    "Immunosuppresseur principal pour prévenir le rejet du greffon. Le dosage doit être dans la fenêtre thérapeutique",
  everolimus:
    "Immunosuppresseur complémentaire pour protéger le greffon rénal. Nécessite une surveillance régulière du dosage",
}

let formData = {
  date_questionnaire: new Date().toISOString().split("T")[0],
  poids: "",
  envie_uriner: "",
  frequence: "non",
  frequence_urinaire: "",
  douleur_miction: "",
  douleur_greffon: "",
  maux_ventre: "",
  diarrhee: false,
  intensite_diarrhee: "",
  frissonnement: "Non",
  creatinine: "",
  tension_systolique: "",
  tension_diastolique: "",
  frequence_cardiaque: "",
  temperature: "",
  glycemie: "",
  hemoglobine: "",
  cholesterol: "",
  tacrolimus_ng: "",
  everolimus_ng: "",
}

let lastAnalysisResults = null
let historicInterpretationMode = false

function renderForm() {
  const formContainer = document.getElementById("form-container")
  formContainer.innerHTML = `
        <form id="patientForm" class="max-w-4xl mx-auto">
            <div class="card">
                <div class="card-header">
                    <div class="flex items-center gap-3 mb-4">
                        <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                        <h2 class="card-title">Symptômes et Informations Générales</h2>
                    </div>
                    <p class="card-description">Veuillez renseigner les symptômes et la date du questionnaire</p>
                </div>
                <div class="card-content space-y-6">
                    <div class="grid grid-2">
                        <div class="form-group">
                            <label for="date_questionnaire">Date du questionnaire</label>
                            <input type="date" id="date_questionnaire" value="${formData.date_questionnaire}" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <div class="label-with-info">
                            <label for="poids">Poids <span class="text-sm text-muted-foreground">(kg)</span></label>
                            <span class="info-icon" data-info="${INFO_TEXTS.poids}">ⓘ</span>
                        </div>
                        <input type="number" id="poids" step="0.1" placeholder="Ex: 70" value="${formData.poids}" required>
                        <div class="normal-value" id="poids-normal"></div>
                    </div>

                    <div class="form-group">
                        <div class="label-with-info">
                            <label>Envie d'uriner <span class="text-sm text-muted-foreground">(1 à 10)</span></label>
                            <span class="info-icon" data-info="${INFO_TEXTS.envie_uriner}">ⓘ</span>
                        </div>
                        <div class="scale-buttons" id="envie_uriner_buttons"></div>
                        <div class="normal-value" id="envie-uriner-selected"></div>
                    </div>

                    <div class="form-group">
                        <div class="label-with-info">
                            <label>Fréquence</label>
                            <span class="info-icon" data-info="${INFO_TEXTS.frequence}">ⓘ</span>
                        </div>
                        <div class="radio-group">
                            <div class="radio-item">
                                <input type="radio" id="freq-non" name="frequence" value="non" ${formData.frequence === "non" ? "checked" : ""}>
                                <label for="freq-non" style="margin-bottom: 0;">Non</label>
                            </div>
                            <div class="radio-item">
                                <input type="radio" id="freq-occ" name="frequence" value="occasionnel" ${formData.frequence === "occasionnel" ? "checked" : ""}>
                                <label for="freq-occ" style="margin-bottom: 0;">Occasionnel</label>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <div class="label-with-info">
                            <label for="frequence_urinaire">Fréquence urinaire <span class="text-sm text-muted-foreground">(fois/jour)</span></label>
                            <span class="info-icon" data-info="${INFO_TEXTS.frequence_urinaire}">ⓘ</span>
                        </div>
                        <input type="number" id="frequence_urinaire" placeholder="Ex: 6" value="${formData.frequence_urinaire}" required>
                        <div class="normal-value">Valeur normale: 4-7 fois/jour</div>
                    </div>

                    <div class="form-group">
                        <div class="label-with-info">
                            <label>Douleur à la miction <span class="text-sm text-muted-foreground">(1 à 10)</span></label>
                            <span class="info-icon" data-info="${INFO_TEXTS.douleur_miction}">ⓘ</span>
                        </div>
                        <div class="scale-buttons" id="douleur_miction_buttons"></div>
                        <div class="normal-value" id="douleur-miction-selected"></div>
                    </div>

                    <div class="form-group">
                        <div class="label-with-info">
                            <label>Douleur du greffon <span class="text-sm text-muted-foreground">(1 à 10)</span></label>
                            <span class="info-icon" data-info="${INFO_TEXTS.douleur_greffon}">ⓘ</span>
                        </div>
                        <div class="scale-buttons" id="douleur_greffon_buttons"></div>
                        <div class="normal-value" id="douleur-greffon-selected"></div>
                    </div>

                    <div class="form-group">
                        <div class="label-with-info">
                            <label>Maux de ventre <span class="text-sm text-muted-foreground">(1 à 10)</span></label>
                            <span class="info-icon" data-info="${INFO_TEXTS.maux_ventre}">ⓘ</span>
                        </div>
                        <div class="scale-buttons" id="maux_ventre_buttons"></div>
                        <div class="normal-value" id="maux-ventre-selected"></div>
                    </div>

                    <div class="form-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="diarrhee" ${formData.diarrhee ? "checked" : ""}>
                            <label for="diarrhee" style="margin-bottom: 0;">Diarrhée</label>
                            <span class="info-icon" data-info="${INFO_TEXTS.diarrhee}">ⓘ</span>
                        </div>
                        <div id="diarrhee-intensity" style="display: ${formData.diarrhee ? "block" : "none"}; margin-left: 1.5rem; margin-top: 1rem;">
                            <label>Intensité de la diarrhée <span class="text-sm text-muted-foreground">(1 à 10)</span></label>
                            <div class="scale-buttons" id="intensite_diarrhee_buttons"></div>
                            <div class="normal-value" id="intensite-diarrhee-selected"></div>
                        </div>
                    </div>

                    <div class="form-group">
                        <div class="label-with-info">
                            <label>Frissonnement</label>
                            <span class="info-icon" data-info="${INFO_TEXTS.frissonnement}">ⓘ</span>
                        </div>
                        <div class="radio-group">
                            <div class="radio-item">
                                <input type="radio" id="friss-non" name="frissonnement" value="Non" ${formData.frissonnement === "Non" ? "checked" : ""}>
                                <label for="friss-non" style="margin-bottom: 0;">Non</label>
                            </div>
                            <div class="radio-item">
                                <input type="radio" id="friss-occ" name="frissonnement" value="occasionnellement" ${formData.frissonnement === "occasionnellement" ? "checked" : ""}>
                                <label for="friss-occ" style="margin-bottom: 0;">Occasionnellement</label>
                            </div>
                            <div class="radio-item">
                                <input type="radio" id="friss-souvent" name="frissonnement" value="souvent" ${formData.frissonnement === "souvent" ? "checked" : ""}>
                                <label for="friss-souvent" style="margin-bottom: 0;">Souvent</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <div class="flex items-center gap-3 mb-4">
                        <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                        <h2 class="card-title">Analyses Biologiques et Paramètres Vitaux</h2>
                    </div>
                    <p class="card-description">Résultats des analyses et mesures cliniques</p>
                </div>
                <div class="card-content space-y-6">
                    <div class="grid grid-2">
                        <div class="form-group">
                            <div class="label-with-info">
                                <label for="creatinine">Créatinine <span class="text-sm text-muted-foreground">(mg/L)</span></label>
                                <span class="info-icon" data-info="${INFO_TEXTS.creatinine}">ⓘ</span>
                            </div>
                            <input type="number" id="creatinine" step="0.1" placeholder="Ex: 95" value="${formData.creatinine}" required>
                            <div class="normal-value" id="creatinine-normal"></div>
                        </div>

                        <div class="form-group">
                            <div class="label-with-info">
                                <label for="tension_systolique">Tension systolique <span class="text-sm text-muted-foreground">(mmHg)</span></label>
                                <span class="info-icon" data-info="${INFO_TEXTS.tension_systolique}">ⓘ</span>
                            </div>
                            <input type="number" id="tension_systolique" placeholder="Ex: 120" value="${formData.tension_systolique}" required>
                            <div class="normal-value">Valeur normale: 100-140 mmHg</div>
                        </div>

                        <div class="form-group">
                            <div class="label-with-info">
                                <label for="tension_diastolique">Tension diastolique <span class="text-sm text-muted-foreground">(mmHg)</span></label>
                                <span class="info-icon" data-info="${INFO_TEXTS.tension_diastolique}">ⓘ</span>
                            </div>
                            <input type="number" id="tension_diastolique" placeholder="Ex: 80" value="${formData.tension_diastolique}" required>
                            <div class="normal-value">Valeur normale: 60-90 mmHg</div>
                        </div>

                        <div class="form-group">
                            <div class="label-with-info">
                                <label for="frequence_cardiaque">Fréquence cardiaque <span class="text-sm text-muted-foreground">(batt/min)</span></label>
                                <span class="info-icon" data-info="${INFO_TEXTS.frequence_cardiaque}">ⓘ</span>
                            </div>
                            <input type="number" id="frequence_cardiaque" placeholder="Ex: 72" value="${formData.frequence_cardiaque}" required>
                            <div class="normal-value">Valeur normale: 60-80 batt/min</div>
                        </div>

                        <div class="form-group">
                            <div class="label-with-info">
                                <label for="temperature">Température <span class="text-sm text-muted-foreground">(°C)</span></label>
                                <span class="info-icon" data-info="${INFO_TEXTS.temperature}">ⓘ</span>
                            </div>
                            <input type="number" id="temperature" step="0.1" placeholder="Ex: 37.0" value="${formData.temperature}" required>
                            <div class="normal-value">Valeur normale: 36.5-37.5°C</div>
                        </div>

                        <div class="form-group">
                            <div class="label-with-info">
                                <label for="glycemie">Glycémie à jeun <span class="text-sm text-muted-foreground">(g/L)</span></label>
                                <span class="info-icon" data-info="${INFO_TEXTS.glycemie}">ⓘ</span>
                            </div>
                            <input type="number" id="glycemie" step="0.01" placeholder="Ex: 0.95" value="${formData.glycemie}" required>
                            <div class="normal-value">Valeur normale: 0.70-1.00 g/L</div>
                        </div>

                        <div class="form-group">
                            <div class="label-with-info">
                                <label for="hemoglobine">Hémoglobine <span class="text-sm text-muted-foreground">(g/dL)</span></label>
                                <span class="info-icon" data-info="${INFO_TEXTS.hemoglobine}">ⓘ</span>
                            </div>
                            <input type="number" id="hemoglobine" step="0.1" placeholder="Ex: 13.5" value="${formData.hemoglobine}" required>
                            <div class="normal-value" id="hemoglobine-normal"></div>
                        </div>

                        <div class="form-group">
                            <div class="label-with-info">
                                <label for="cholesterol">Cholestérol total <span class="text-sm text-muted-foreground">(g/L)</span></label>
                                <span class="info-icon" data-info="${INFO_TEXTS.cholesterol}">ⓘ</span>
                            </div>
                            <input type="number" id="cholesterol" step="0.01" placeholder="Ex: 1.80" value="${formData.cholesterol}" required>
                            <div class="normal-value">Valeur normale: 0-2.00 g/L</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <div class="flex items-center gap-3 mb-4">
                        <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                        </svg>
                        <h2 class="card-title">Traitement</h2>
                    </div>
                    <p class="card-description">Posologie des médicaments immunosuppresseurs</p>
                </div>
                <div class="card-content space-y-6">
                    <div class="grid grid-2">
                        <div class="form-group">
                            <div class="label-with-info">
                                <label for="tacrolimus_ng">Tacrolimus (Advagraf) <span class="text-sm text-muted-foreground">(ng/mL)</span></label>
                                <span class="info-icon" data-info="${INFO_TEXTS.tacrolimus}">ⓘ</span>
                            </div>
                            <input type="number" id="tacrolimus_ng" step="0.1" placeholder="Ex: 5.2" value="${formData.tacrolimus_ng}" required>
                            <div class="normal-value">Valeur normale: 3-7 ng/mL</div>
                        </div>

                        <div class="form-group">
                            <div class="label-with-info">
                                <label for="everolimus_ng">Évérolimus (Certican) <span class="text-sm text-muted-foreground">(ng/mL)</span></label>
                                <span class="info-icon" data-info="${INFO_TEXTS.everolimus}">ⓘ</span>
                            </div>
                            <input type="number" id="everolimus_ng" step="0.1" placeholder="Ex: 4.5" value="${formData.everolimus_ng}" required>
                            <div class="normal-value">Valeur normale: 3-8 ng/mL</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex justify-center mb-4">
                <button type="submit" class="button button-primary button-submit" id="analyzeBtn">
                    Analyser
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                </button>
            </div>
        </form>
    `

  setupFormListeners()
  renderScaleButtons()
  updateNormalValues()
}

function setupFormListeners() {
  const form = document.getElementById("patientForm")

  document.getElementById("date_questionnaire").addEventListener("change", (e) => {
    formData.date_questionnaire = e.target.value
  })

  document.getElementById("poids").addEventListener("change", (e) => {
    formData.poids = Number.parseFloat(e.target.value) || ""
  })

  document.querySelectorAll('input[name="frequence"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      formData.frequence = e.target.value
    })
  })

  document.querySelectorAll('input[name="frissonnement"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      formData.frissonnement = e.target.value
    })
  })

  document.getElementById("frequence_urinaire").addEventListener("change", (e) => {
    formData.frequence_urinaire = Number.parseInt(e.target.value) || ""
  })

  document.getElementById("creatinine").addEventListener("change", (e) => {
    formData.creatinine = Number.parseFloat(e.target.value) || ""
  })

  document.getElementById("tension_systolique").addEventListener("change", (e) => {
    formData.tension_systolique = Number.parseInt(e.target.value) || ""
  })

  document.getElementById("tension_diastolique").addEventListener("change", (e) => {
    formData.tension_diastolique = Number.parseInt(e.target.value) || ""
  })

  document.getElementById("frequence_cardiaque").addEventListener("change", (e) => {
    formData.frequence_cardiaque = Number.parseInt(e.target.value) || ""
  })

  document.getElementById("temperature").addEventListener("change", (e) => {
    formData.temperature = Number.parseFloat(e.target.value) || ""
  })

  document.getElementById("glycemie").addEventListener("change", (e) => {
    formData.glycemie = Number.parseFloat(e.target.value) || ""
  })

  document.getElementById("hemoglobine").addEventListener("change", (e) => {
    formData.hemoglobine = Number.parseFloat(e.target.value) || ""
  })

  document.getElementById("cholesterol").addEventListener("change", (e) => {
    formData.cholesterol = Number.parseFloat(e.target.value) || ""
  })

  document.getElementById("tacrolimus_ng").addEventListener("change", (e) => {
    formData.tacrolimus_ng = Number.parseFloat(e.target.value) || ""
  })

  document.getElementById("everolimus_ng").addEventListener("change", (e) => {
    formData.everolimus_ng = Number.parseFloat(e.target.value) || ""
  })

  document.getElementById("diarrhee").addEventListener("change", (e) => {
    formData.diarrhee = e.target.checked
    document.getElementById("diarrhee-intensity").style.display = formData.diarrhee ? "block" : "none"
    renderScaleButtons()
  })

  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    if (isFormValid()) {
      await handleAnalyzeAndSave()
    }
  })
}

async function handleAnalyzeAndSave() {
  const analyzeBtn = document.getElementById("analyzeBtn")
  const originalInnerHTML = analyzeBtn ? analyzeBtn.innerHTML : ""

  if (analyzeBtn) {
    analyzeBtn.disabled = true
    analyzeBtn.innerHTML = "Analyse en cours..."
  }

  let saveStatus = null

  try {
    await saveQuestionnaireResponse()
    saveStatus = { success: true }
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du questionnaire:", error)
    saveStatus = { success: false, message: error.message }
  }

  analyzeResults(saveStatus)

  if (analyzeBtn) {
    analyzeBtn.disabled = false
    analyzeBtn.innerHTML = originalInnerHTML
  }
}

async function saveQuestionnaireResponse() {
  const { patientId, dossierMedicalId } = getPatientIdentifiers()

  if (!patientId) {
    throw new Error("Connexion requise pour envoyer le questionnaire.")
  }

  const payload = {
    id_dossier_medical: dossierMedicalId,
    date_questionnaire: formData.date_questionnaire,
    poids: formData.poids === "" ? null : formData.poids,
    envie_uriner:
      formData.envie_uriner === "" || formData.envie_uriner == null
        ? null
        : formData.envie_uriner.toString(),
    frequence: formData.frequence || null,
    frequence_urinaire:
      formData.frequence_urinaire === "" || formData.frequence_urinaire == null
        ? null
        : formData.frequence_urinaire.toString(),
    douleur_miction:
      formData.douleur_miction === "" || formData.douleur_miction == null
        ? null
        : formData.douleur_miction.toString(),
    douleur_greffon:
      formData.douleur_greffon === "" || formData.douleur_greffon == null
        ? null
        : formData.douleur_greffon.toString(),
    maux_ventre:
      formData.maux_ventre === "" || formData.maux_ventre == null
        ? null
        : formData.maux_ventre.toString(),
    diarrhee: !!formData.diarrhee,
    intensite_diarrhee:
      formData.diarrhee && formData.intensite_diarrhee !== "" && formData.intensite_diarrhee != null
        ? formData.intensite_diarrhee.toString()
        : null,
    frissonnement: formData.frissonnement || null,
    creatinine: formData.creatinine === "" ? null : formData.creatinine,
    tension_systolique: formData.tension_systolique === "" ? null : formData.tension_systolique,
    tension_diastolique: formData.tension_diastolique === "" ? null : formData.tension_diastolique,
    frequence_cardiaque: formData.frequence_cardiaque === "" ? null : formData.frequence_cardiaque,
    temperature: formData.temperature === "" ? null : formData.temperature,
    glycemie: formData.glycemie === "" ? null : formData.glycemie,
    hemoglobine: formData.hemoglobine === "" ? null : formData.hemoglobine,
    cholesterol: formData.cholesterol === "" ? null : formData.cholesterol,
    tacrolimus_ng: formData.tacrolimus_ng === "" ? null : formData.tacrolimus_ng,
    everolimus_ng: formData.everolimus_ng === "" ? null : formData.everolimus_ng,
  }

  const response = await fetch(`/api/patients/${patientId}/reponses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const result = await response.json()

  if (!response.ok || !result.success) {
    const detail = result.details ? ` (${result.details})` : ""
    throw new Error((result.error || "Impossible d'enregistrer la reponse.") + detail)
  }

  // Mémoriser l'id du dossier médical résolu côté serveur pour les prochains envois
  const dossierIdFromServer = result.dossier_id || result.reponse?.id_dossier_medical
  if (dossierIdFromServer) {
    localStorage.setItem("dossier_medical_id", dossierIdFromServer)
  }

  return result
}

function getPatientIdentifiers() {
  const patientId = localStorage.getItem("user_id")
  const dossierMedicalId = localStorage.getItem("dossier_medical_id")

  if (!patientId) {
    throw new Error("Connexion requise pour envoyer le questionnaire.")
  }

  if (!dossierMedicalId) {
    throw new Error("Dossier médical introuvable. Rechargez la page pour le récupérer depuis le serveur.")
  }

  console.log("Patient Identifiers:", { patientId, dossierMedicalId })
  // log terminal npm
  console.log(`Patient Identifiers: patientId=${patientId}, dossierMedicalId=${dossierMedicalId}`)
  return { patientId, dossierMedicalId }
}

async function preloadDossierId() {
  const patientId = localStorage.getItem("user_id")
  const token = localStorage.getItem("auth_token") || patientId
  if (!patientId) return

  try {
    const response = await fetch(`/api/patients/${patientId}/dossier-id`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const text = await response.text()
    let result = {}
    try {
      result = text ? JSON.parse(text) : {}
    } catch (e) {
      console.warn('Réponse non JSON lors du préchargement dossier:', text)
      result = {}
    }

    if (!response.ok || !result.success || !result.dossier_id) {
      console.warn("Impossible de précharger l'id du dossier médical:", result.error || response.statusText)
      return
    }

    localStorage.setItem("dossier_medical_id", result.dossier_id)
  } catch (err) {
    console.error("Erreur lors du préchargement de l'id du dossier médical:", err)
  }
}

function renderScaleButtons() {
  const scales = [
    { id: "envie_uriner", field: "envie_uriner" },
    { id: "douleur_miction", field: "douleur_miction" },
    { id: "douleur_greffon", field: "douleur_greffon" },
    { id: "maux_ventre", field: "maux_ventre" },
    { id: "intensite_diarrhee", field: "intensite_diarrhee" },
  ]

  scales.forEach((scale) => {
    const container = document.getElementById(scale.id + "_buttons")
    if (container) {
      container.innerHTML = ""
      for (let i = 1; i <= 10; i++) {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = `scale-btn ${formData[scale.field] === i ? "active" : ""}`
        btn.textContent = i
        btn.addEventListener("click", (e) => {
          e.preventDefault()
          formData[scale.field] = i
          renderScaleButtons()
          updateScaleDisplay(scale.id, i)
        })
        container.appendChild(btn)
      }
    }
  })
}

function updateScaleDisplay(id, value) {
  const displayElement = document.getElementById(id.replace("_buttons", "") + "-selected")
  if (displayElement) {
    displayElement.textContent = `Sélectionné: ${value}/10`
  }
}

function updateNormalValues() {
  const ranges = getReferenceRanges()

  const creatinineNormal = document.getElementById("creatinine-normal")
  if (creatinineNormal) {
    creatinineNormal.textContent = `Valeur normale: ${ranges.creatinine.min}-${ranges.creatinine.max} mg/L`
  }

  const hemoglobineNormal = document.getElementById("hemoglobine-normal")
  if (hemoglobineNormal) {
    hemoglobineNormal.textContent = `Valeur normale: ${ranges.hemoglobine.min}-${ranges.hemoglobine.max} g/dL`
  }
}

function isFormValid() {
  return (
    formData.date_questionnaire &&
    formData.poids &&
    formData.envie_uriner &&
    formData.frequence &&
    formData.frequence_urinaire &&
    formData.douleur_miction &&
    formData.douleur_greffon &&
    formData.maux_ventre &&
    formData.diarrhee !== undefined &&
    (formData.diarrhee ? formData.intensite_diarrhee : true) &&
    formData.frissonnement &&
    formData.creatinine &&
    formData.tension_systolique &&
    formData.tension_diastolique &&
    formData.frequence_cardiaque &&
    formData.temperature &&
    formData.glycemie &&
    formData.hemoglobine &&
    formData.cholesterol &&
    formData.tacrolimus_ng &&
    formData.everolimus_ng
  )
}

function calculateDFG(creatinineMgL) {
  const creatinineMgDl = creatinineMgL / 10
  const dfg = Math.round(140 / creatinineMgDl)
  return Math.max(dfg, 5)
}

function analyzeResults(saveStatus = null) {
  const dfg = calculateDFG(formData.creatinine)
  let stageLabel = ""
  let severity = "normal"

  if (dfg >= 90) {
    stageLabel = "Fonction rénale normale"
    severity = "normal"
  } else if (dfg >= 60) {
    stageLabel = "Insuffisance rénale légère"
    severity = "warning"
  } else if (dfg >= 45) {
    stageLabel = "Insuffisance rénale modérée (3a)"
    severity = "warning"
  } else if (dfg >= 30) {
    stageLabel = "Insuffisance rénale modérée (3b)"
    severity = "danger"
  } else if (dfg >= 15) {
    stageLabel = "Insuffisance rénale sévère"
    severity = "danger"
  } else {
    stageLabel = "Insuffisance rénale terminale"
    severity = "danger"
  }

  const criticalAlerts = checkCriticalValues(dfg)
  const recommendations = generateRecommendations(dfg)

  const results = {
    dfg,
    stageLabel,
    severity,
    criticalAlerts,
    recommendations,
  }

  lastAnalysisResults = results

  renderResults(results, saveStatus)
}

function checkCriticalValues(dfg) {
  const alerts = []

  if (formData.creatinine > 150) alerts.push("Créatinine très élevée - Insuffisance rénale sévère")
  if (formData.tension_systolique > 180 || formData.tension_systolique < 90) alerts.push("Tension artérielle critique")
  if (formData.temperature > 38.5 || formData.temperature < 35) alerts.push("Température anormale")
  if (formData.glycemie > 2.5 || formData.glycemie < 0.5) alerts.push("Glycémie critique")
  if (formData.hemoglobine < 8) alerts.push("Anémie sévère")
  if (dfg < 15) alerts.push("Insuffisance rénale terminale")
  if (formData.douleur_greffon >= 7) alerts.push("Douleur du greffon importante")
  if (formData.frequence_cardiaque > 100 || formData.frequence_cardiaque < 50)
    alerts.push("Fréquence cardiaque anormale")
  if (formData.tacrolimus_ng < 3 || formData.tacrolimus_ng > 7) alerts.push("Taux de tacrolimus hors cible")
  if (formData.everolimus_ng > 8) alerts.push("Taux d'évérolimus toxique")

  return alerts
}

function generateRecommendations(dfg) {
  const recommendations = []
  const ranges = getReferenceRanges()

  if (formData.envie_uriner >= 7) {
    recommendations.push("Envie d'uriner élevée: Peut indiquer une infection urinaire ou un problème de vessie.")
  }

  if (formData.douleur_miction >= 5) {
    recommendations.push("Douleur à la miction: Consultation recommandée pour écarter une infection urinaire.")
  }

  if (formData.douleur_greffon >= 5) {
    recommendations.push(
      "Douleur du greffon: Surveillance étroite nécessaire, peut indiquer un rejet ou une complication.",
    )
  }

  if (formData.temperature >= 38) {
    recommendations.push(
      "Fièvre détectée: Peut indiquer une infection. Consultation médicale si la fièvre persiste plus de 24h.",
    )
  }

  if (formData.glycemie >= 1.26) {
    recommendations.push(
      "Diabète: Glycémie ≥1.26 g/L, surveillance diabétique nécessaire. Contrôle glycémique régulier recommandé.",
    )
  }

  if (formData.hemoglobine < 12) {
    recommendations.push("Anémie détectée: Supplémentation en fer et EPO possible selon avis médical.")
  }

  if (formData.tension_systolique > 140) {
    recommendations.push("Hypertension artérielle: Contrôle tensionnel strict recommandé pour protéger le greffon.")
  }

  if (formData.creatinine > ranges.creatinine.max) {
    recommendations.push("Créatinine élevée: Surveillance rapprochée de la fonction rénale nécessaire.")
  }

  if (formData.tacrolimus_ng < 3) {
    recommendations.push("Tacrolimus sous-dosé: Risque de rejet du greffon. Ajustement de la dose nécessaire.")
  } else if (formData.tacrolimus_ng > 7) {
    recommendations.push("Tacrolimus surdosé: Risque de toxicité. Réduction de la dose à envisager.")
  }

  if (formData.cholesterol > 2.4) {
    recommendations.push("Hypercholestérolémie: Régime alimentaire adapté et statines possibles selon avis médical.")
  }

  if (dfg >= 3) {
    recommendations.push(
      "Suivi néphrologique régulier recommandé. Régime adapté: Contrôle des protéines, du sel et du phosphore.",
    )
  }

  recommendations.push("Respecter scrupuleusement les horaires de prise des immunosuppresseurs.")

  return recommendations
}

function getReferenceRanges() {
  // Valeurs de reference par defaut (profil neutre)
  return NORMAL_RANGES.Homme
}

function renderResults(results, saveStatus = null) {
  const container = document.getElementById("form-container")
  const resultsContainer = document.getElementById("results-container")

  container.style.display = "none"
  resultsContainer.style.display = "block"

  const severityClass =
    results.severity === "danger"
      ? "alert-destructive"
      : results.severity === "warning"
        ? "alert-warning"
        : "alert-success"

  const iconColor =
    results.severity === "danger"
      ? "text-destructive"
      : results.severity === "warning"
        ? "text-warning"
        : "text-success"

  let html = ""

  if (saveStatus) {
    const statusClass = saveStatus.success ? "alert-success" : "alert-destructive"
    const statusIconPath = saveStatus.success ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"
    const statusMessage = saveStatus.success
      ? "Reponses enregistrees dans la base de donnees."
      : `Enregistrement impossible: ${saveStatus.message || "veuillez reessayer."}`

    html += `
        <div class="alert ${statusClass}" style="border-left: 4px solid;">
            <div class="alert-title" style="display: flex; align-items: center; gap: 0.5rem;">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${statusIconPath}"></path>
                </svg>
                <span>${statusMessage}</span>
            </div>
            ${saveStatus.success
        ? ""
        : '<div class="alert-description" style="margin-top: 0.5rem;">Vos resultats sont affiches mais n\'ont pas pu etre sauvegardes.</div>'
      }
        </div>
    `
  }

  if (results.criticalAlerts.length > 0) {
    html += `
            <div class="alert alert-destructive" style="border-left: 4px solid;">
                <div class="alert-title" style="display: flex; align-items: center; gap: 0.5rem;">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    ⚠️ ALERTE MÉDICALE URGENTE
                </div>
                <div class="alert-description">
                    <p style="font-weight: 600; margin: 0.5rem 0;">Vos résultats montrent des valeurs critiques nécessitant une attention médicale immédiate :</p>
                    <ul style="margin: 1rem 0; padding-left: 1.25rem;">
                        ${results.criticalAlerts.map((alert) => `<li>${alert}</li>`).join("")}
                    </ul>
                    <div style="background-color: var(--background); padding: 1rem; border-radius: var(--radius); border: 2px solid var(--destructive); margin-top: 1rem;">
                        <p style="font-weight: 700; font-size: 1.1rem; color: var(--destructive); margin: 0;">
                            → CONTACTEZ IMMÉDIATEMENT VOTRE NÉPHROLOGUE OU RENDEZ-VOUS AUX URGENCES
                        </p>
                    </div>
                </div>
            </div>
        `
  }

  html += `
        <div class="card border-2">
            <div class="card-header">
                    <div>
                        <h2 class="card-title text-2xl mb-2">Résultats de l'Évaluation</h2>
                        <p class="card-description">
                            Questionnaire du ${new Date(formData.date_questionnaire).toLocaleDateString("fr-FR")}
                        </p>
                    </div>
                    <div class="flex gap-2">
                        <button type="button" class="button button-outline" onclick="copyToClipboard()">
                            <svg class="w-4 h-4" style="margin-right: 0.5rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                            </svg>
                            Copier pour IA
                        </button>
                        <button type="button" class="button button-outline" onclick="downloadPdf()">
                          <svg class="w-4 h-4" style="margin-right: 0.5rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v16c0 1.105.895 2 2 2h12a2 2 0 002-2V4M8 4h8M12 11v6m0 0l-3-3m3 3l3-3"></path>
                          </svg>
                          Télécharger le PDF
                        </button>
                        <button type="button" class="button button-outline" onclick="resetForm()">
                            <svg class="w-4 h-4" style="margin-right: 0.5rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                            Nouveau
                        </button>
                    </div>
                </div>
            </div>
            <div class="card-content">
                <div class="flex items-center gap-4 p-6 rounded-lg" style="background-color: ${results.severity === "normal" ? "rgba(16, 185, 129, 0.1)" : results.severity === "warning" ? "rgba(245, 158, 11, 0.1)" : "rgba(220, 38, 38, 0.1)"};">
                    <svg class="w-12 h-12 ${iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        ${results.severity === "normal" ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>' : results.severity === "warning" ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>' : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4v2m0 0H9m3 0h3"></path>'}
                    </svg>
                    <div class="flex-1">
                        <h3 class="text-xl font-semibold mb-1">${results.stageLabel}</h3>
                        <p class="text-muted-foreground">Stade de la maladie rénale chronique</p>
                    </div>
                    <div class="text-right">
                        <div class="text-3xl font-bold">${results.dfg}</div>
                        <div class="text-sm text-muted-foreground">mL/min/1.73m²</div>
                        <div class="text-xs text-muted-foreground mt-1">DFG estimé</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title" style="display: flex; align-items: center; gap: 0.5rem; color: var(--warning);">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Recommandations Médicales
                </h2>
                <p class="card-description">Conseils basés sur les résultats de l'évaluation</p>
            </div>
            <div class="card-content space-y-3">
                ${results.recommendations
      .map(
        (rec) => `
                    <div class="alert border-l-4 border-l-primary">
                        <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div class="alert-description" style="margin-left: 0.5rem;">${rec}</div>
                    </div>
                `,
      )
      .join("")}
            </div>
        </div>

        <div class="alert">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div class="alert-title" style="margin: 0; font-weight: 600;">Avertissement Important</div>
            </div>
            <div class="alert-description" style="margin-top: 0.5rem;">
                Ces résultats sont fournis à titre informatif uniquement et ne remplacent pas un avis médical professionnel. Consultez toujours un néphrologue ou votre médecin traitant pour une évaluation complète et un plan de traitement adapté.
            </div>
        </div>
    `

  resultsContainer.innerHTML = html
}

function resetForm() {
  formData = {
    date_questionnaire: new Date().toISOString().split("T")[0],
    poids: "",
    envie_uriner: "",
    frequence: "non",
    frequence_urinaire: "",
    douleur_miction: "",
    douleur_greffon: "",
    maux_ventre: "",
    diarrhee: false,
    intensite_diarrhee: "",
    frissonnement: "Non",
    creatinine: "",
    tension_systolique: "",
    tension_diastolique: "",
    frequence_cardiaque: "",
    temperature: "",
    glycemie: "",
    hemoglobine: "",
    cholesterol: "",
    tacrolimus_ng: "",
    everolimus_ng: "",
  }

  document.getElementById("form-container").style.display = "block"
  document.getElementById("results-container").style.display = "none"
  renderForm()
}

document.addEventListener("DOMContentLoaded", async () => {
  await preloadDossierId()
  await maybeLoadHistoricResponse()
  if (!historicInterpretationMode) {
    renderForm()
  }
})

function copyToClipboard() {
  if (!lastAnalysisResults) return

  const textSummary = generateMedicalSummary(formData, lastAnalysisResults)

  navigator.clipboard.writeText(textSummary).then(() => {
    // Feedback visuel temporaire
    const btn = document.querySelector('button[onclick="copyToClipboard()"]')
    if (btn) {
      const originalText = btn.innerHTML
      btn.innerHTML = `
        <svg class="w-4 h-4" style="margin-right: 0.5rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        Copié !
      `
      setTimeout(() => {
        btn.innerHTML = originalText
      }, 2000)
    }
  }).catch(err => {
    console.error('Erreur lors de la copie :', err)
    alert('Impossible de copier le texte automatiquement.')
  })
}

function formatValueWithUnit(value, unit) {
  if (value === null || value === undefined || value === '') return '—';
  return `${value} ${unit || ''}`.trim()
}

function downloadPdf() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF non disponible: librairie manquante.');
    return;
  }
  if (!lastAnalysisResults) {
    alert('Générez d’abord les résultats pour créer le PDF.');
    return;
  }

  const doc = new window.jspdf.jsPDF();
  const margin = 15;

  doc.setFontSize(14);
  doc.text('www.renalcare.fr', 105, margin, { align: 'center' });

  doc.setFontSize(18);
  doc.text('Synthèse questionnaire patient', 105, margin + 10, { align: 'center' });

  doc.setFontSize(12);
  const dateLabel = formData.date_questionnaire
    ? new Date(formData.date_questionnaire).toLocaleDateString('fr-FR')
    : 'Date non précisée';
  doc.text(`Date du questionnaire : ${dateLabel}`, margin, margin + 20);
  doc.text(`DFG estimé : ${lastAnalysisResults.dfg} mL/min/1.73m²`, margin, margin + 28);
  doc.text(`Stade : ${lastAnalysisResults.stageLabel}`, margin, margin + 36);

  const alerts = lastAnalysisResults.criticalAlerts || [];
  if (alerts.length) {
    doc.setTextColor(200, 0, 0);
    doc.text('Alertes critiques détectées :', margin, margin + 46);
    doc.setTextColor(0, 0, 0);
    alerts.slice(0, 4).forEach((a, idx) => {
      doc.text(`- ${a}`, margin + 4, margin + 54 + idx * 8);
    });
  }

  const tableTitleY = alerts.length ? margin + 54 + alerts.length * 8 + 8 : margin + 46;
  doc.setFontSize(13);
  doc.text('Valeurs mesurées', margin, tableTitleY);

  const rows = [
    ['Poids', formatValueWithUnit(formData.poids, 'kg')],
    ['Créatinine', formatValueWithUnit(formData.creatinine, 'mg/L')],
    ['Tension', formData.tension_systolique && formData.tension_diastolique ? `${formData.tension_systolique}/${formData.tension_diastolique} mmHg` : '—'],
    ['Température', formatValueWithUnit(formData.temperature, '°C')],
    ['Glycémie', formatValueWithUnit(formData.glycemie, 'g/L')],
    ['Hémoglobine', formatValueWithUnit(formData.hemoglobine, 'g/dL')],
    ['Tacrolimus', formatValueWithUnit(formData.tacrolimus_ng, 'ng/mL')],
    ['Évérolimus', formatValueWithUnit(formData.everolimus_ng, 'ng/mL')],
    ['Fréquence cardiaque', formatValueWithUnit(formData.frequence_cardiaque, 'bpm')],
    ['Fréquence urinaire', formData.frequence_urinaire ? `${formData.frequence_urinaire} fois/jour` : '—'],
  ];

  const tableY = tableTitleY + 6;
  const rowHeight = 8;
  const tableWidth = 180;
  const headerHeight = 10;
  const totalHeight = headerHeight + rows.length * rowHeight;

  doc.setDrawColor(200);
  doc.rect(margin, tableY, tableWidth, totalHeight);
  doc.line(margin, tableY + headerHeight, margin + tableWidth, tableY + headerHeight);
  doc.line(margin + 100, tableY, margin + 100, tableY + totalHeight);

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Paramètre', margin + 4, tableY + 7);
  doc.text('Valeur', margin + 104, tableY + 7);
  doc.setFont(undefined, 'normal');

  rows.forEach((row, idx) => {
    const y = tableY + headerHeight + (idx + 1) * rowHeight - 2;
    doc.text(row[0], margin + 4, y);
    doc.text(row[1], margin + 104, y);
    doc.line(margin, tableY + headerHeight + (idx + 1) * rowHeight, margin + tableWidth, tableY + headerHeight + (idx + 1) * rowHeight);
  });

  doc.setFontSize(10);
  doc.text('Document généré automatiquement pour interprétation médicale.', margin, 285);

  doc.save('questionnaire-renalcare.pdf');
}

function applyRowToFormData(row) {
  formData = {
    date_questionnaire: row.date ? row.date.split('T')[0] : new Date().toISOString().split('T')[0],
    poids: row.poids ?? '',
    envie_uriner: row.envie_uriner ? Number(row.envie_uriner) : '',
    frequence: row.frequence || 'non',
    frequence_urinaire: row.frequence_urinaire ? Number(row.frequence_urinaire) : '',
    douleur_miction: row.douleur_miction ? Number(row.douleur_miction) : '',
    douleur_greffon: row.douleur_greffon ? Number(row.douleur_greffon) : '',
    maux_ventre: row.maux_ventre ? Number(row.maux_ventre) : '',
    diarrhee: !!row.diarrhee,
    intensite_diarrhee: row.intensite_diarrhee ? Number(row.intensite_diarrhee) : '',
    frissonnement: row.frissonnement || 'Non',
    creatinine: row.creatinine ?? '',
    tension_systolique: row.tension_systolique ?? '',
    tension_diastolique: row.tension_diastolique ?? '',
    frequence_cardiaque: row.frequence_cardiaque ?? '',
    temperature: row.temperature ?? '',
    glycemie: row.glycemie ?? '',
    hemoglobine: row.hemoglobine ?? '',
    cholesterol: row.cholesterol ?? '',
    tacrolimus_ng: row.tacrolimus_ng ?? '',
    everolimus_ng: row.everolimus_ng ?? '',
  }
}

async function maybeLoadHistoricResponse() {
  const params = new URLSearchParams(window.location.search)
  const reponseId = params.get('reponseId')
  if (!reponseId) return

  const userId = localStorage.getItem('user_id')
  const token = localStorage.getItem('auth_token')
  if (!userId || !token) return

  try {
    const resp = await fetch(`/api/patients/${userId}/reponses/${reponseId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) throw new Error('Chargement impossible')
    const data = await resp.json()
    if (!data.success || !data.reponse) throw new Error(data.error || 'Réponse introuvable')

    applyRowToFormData(data.reponse)
    historicInterpretationMode = true
    analyzeResults(null)
  } catch (err) {
    console.error('Historic load:', err)
    historicInterpretationMode = false
  }
}

function generateMedicalSummary(data, analysis) {
  let summary = `Voici mes derniers résultats du ${new Date(data.date_questionnaire).toLocaleDateString("fr-FR")} :\n\n`

  summary += `📋 CONSTANTES :\n`
  if (data.poids) summary += `- Poids : ${data.poids} kg\n`
  if (data.temperature) summary += `- Température : ${data.temperature}°C\n`
  if (data.tension_systolique) summary += `- Tension : ${data.tension_systolique}/${data.tension_diastolique} mmHg\n`
  if (data.frequence_cardiaque) summary += `- Fréquence cardiaque : ${data.frequence_cardiaque} bpm\n`

  summary += `\n🔬 BIOLOGIE :\n`
  if (data.creatinine) summary += `- Créatinine : ${data.creatinine} mg/L (DFG: ${analysis.dfg})\n`
  if (data.hemoglobine) summary += `- Hémoglobine : ${data.hemoglobine} g/dL\n`
  if (data.glycemie) summary += `- Glycémie : ${data.glycemie} g/L\n`
  if (data.tacrolimus_ng) summary += `- Tacrolimus : ${data.tacrolimus_ng} ng/mL\n`

  summary += `\n📊 ANALYSE AUTOMATIQUE :\n`
  summary += `- Stade : ${analysis.stageLabel}\n`

  if (analysis.criticalAlerts.length > 0) {
    summary += `\n⚠️ ALERTES DÉTECTÉES :\n${analysis.criticalAlerts.map(a => '- ' + a).join('\n')}\n`
  }

  summary += `\nPouvez-vous analyser ces résultats et me donner des recommandations ?`

  return summary
}
