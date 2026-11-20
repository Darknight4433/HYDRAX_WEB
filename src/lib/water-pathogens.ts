/**
 * HYDRAXX Waterborne Pathogen & Hydrochemical Correlation Engine.
 *
 * Correlates real-time sensor telemetry (pH and real sensor TDS in ppm) with:
 *   1. Sensor observation & system alert matrix (disinfection efficiency, corrosivity, anomalies)
 *   2. Disease-Awareness Watchlist / Pathogen Awareness Monitor (surveillance target organisms)
 *   3. Infrastructure & Pipe Impact Intelligence (scaling, valve deposits, pipe diameter reduction)
 *
 * Scientific Standard:
 *   - WHO Guidelines for Drinking-water Quality (4th ed.)
 *   - EPA Potability Standards
 *   - Chlorine Disinfection HOCl/OCl- Equilibrium Thermodynamics
 */

export type PathogenRiskLevel = "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "SAFE";

export interface PathogenEntry {
  id: string;
  name: string; // Scientific organism name, e.g. "Vibrio cholerae"
  disease: string; // Clinical disease name, e.g. "Cholera"
  category: string; // e.g. "Bacterial waterborne pathogen", "Protozoan parasite"
  vector: string; // Transmission pathway
  symptoms: string; // Clinical symptoms
  requiredAssay: string; // Gold-standard laboratory diagnostic test
  survivalProfile: string; // Biological survival mechanism across pH & TDS
  imageUrl: string; // Scientific surveillance reference photograph
  riskLevel: PathogenRiskLevel;
  riskScore: number; // 0 to 100
  riskReason: string; // Real-time reason for the assigned risk
  color: string;
  badgeClass: string;
  dotColor: string;
}

export interface SensorObservationAlert {
  id: string;
  observation: string;
  interpretation: string;
  alert: string;
  active: boolean;
  tone: "danger" | "warning" | "neutral" | "success";
}

export interface InfrastructureImpactItem {
  id: string;
  condition: string;
  impact: string;
  active: boolean;
  severity: "danger" | "warning" | "neutral";
}

export interface InfrastructureReferenceImage {
  id: string;
  title: string;
  caption: string;
  imageUrl: string;
}

export interface WaterQualityCorrelation {
  assessedPh: number;
  assessedTds: number;
  overallRisk: PathogenRiskLevel;
  overallScore: number; // 0 to 100
  whatWeCanConclude: string;
  chemicalConcern: string;
  chemicalConcernColor: string;
  infrastructureImpact: string;
  microbialStatus: string;
  protocolRecommendation: string;
  scientificProtocol: string;
  chlorineDisinfectionDetail: string;
  sensorAlerts: SensorObservationAlert[];
  infrastructureItems: InfrastructureImpactItem[];
  infrastructureImages: InfrastructureReferenceImage[];
  pathogens: PathogenEntry[];
}

/**
 * Master library of target waterborne pathogens monitored by HYDRAXX.
 */
export const TARGET_PATHOGENS_DEFINITIONS = [
  {
    id: "vibrio",
    name: "Vibrio cholerae",
    disease: "Cholera",
    category: "Bacterial waterborne pathogen",
    vector: "Fecal-oral transmission through untreated or alkaline-compromised water",
    symptoms: 'Profuse painless watery diarrhea ("rice-water" stools), rapid hypovolemic shock, severe dehydration.',
    requiredAssay: "TCBS Agar Culture & Vibrio Serotyping",
    survivalProfile:
      "Surges when high pH eliminates hypochlorous acid disinfection; highly alkaline-tolerant (optimum pH 8.0–9.2).",
    imageUrl:
      "https://images.openai.com/static-rsc-4/PNQ3yHp2Zkkuc1_HoTRoV7GzmPFKkkyjGPNugnI7xfSPbDMAOFfdeBg5_7LfBjFygaRm2Z7xvsjEelobin2D6Abf4Au9JlO4-aqC3CA5GRreycfUe63l7W6gJEy3bLLvXWvyKw6bE29Ul-hfryWMXyEvJoUitg8I9XKXA458zDI?purpose=inline",
  },
  {
    id: "salmonella",
    name: "Salmonella Typhi",
    disease: "Typhoid fever",
    category: "Bacterial pathogen",
    vector: "Ingestion of water contaminated by carrier bio-effluent",
    symptoms: "Sustained stepwise high fever, delirium, rose spots, severe abdominal pain, intestinal perforation risk.",
    requiredAssay: "Blood & Stool Culture, Widal / Typhidot Serology",
    survivalProfile:
      "Enteric bacterial pathogen; prolonged survival in distribution mains when pipe scale impedes biocide contact.",
    imageUrl:
      "https://images.openai.com/static-rsc-4/grRZVqoMd2wr8DXFZtb1VBnT3Dw1jwk65goGHDmuEiFMSBBRUB2TJTycID2wVU5Pq7V69sfxW5VjHzRJkWzuy63hyO37f7MgdNYgkm9QL7-TjzamOXy6gdODu1brTijZRT8f1ZmQEJYWZQklOPMttHo6qAg2FP_G9Ow8-T-gJFE?purpose=inline",
  },
  {
    id: "ecoli",
    name: "Pathogenic E. coli",
    disease: "Gastrointestinal illness",
    category: "Strain-dependent pathogenicity",
    vector: "Fecal runoff breach entering supply infrastructure",
    symptoms: "Severe abdominal cramping, acute watery or bloody diarrhea, vomiting, hemolytic uremic risk.",
    requiredAssay: "Colilert Chromogenic Culture / E. coli Shiga-Toxin Assay",
    survivalProfile:
      "Primary fecal indicator organism; bacterial survival elevated outside the 6.5–8.5 pH stability window.",
    imageUrl:
      "https://images.openai.com/static-rsc-4/FCuFXPIvOJluUQNMaiKNsLWj_P3jBReKhZk6yOYkAeAC3LiaWa70qhIivnPAfc811auOUOjfDDPWQF9c31eHOuUNUwl6MhU0XATw5cYD2Hui-5SOwXyHKIQdToOrVPrssXI20MtSYqOzBP9TADuYp0-MOrgt6-r0gFpNMJHLg3M?purpose=inline",
  },
  {
    id: "giardia",
    name: "Giardia",
    disease: "Giardiasis",
    category: "Protozoan parasite",
    vector: "Ingestion of microscopic protozoan cysts in drinking supply",
    symptoms: "Persistent chronic diarrhea, foul-smelling greasy stools, abdominal distension, severe malabsorption.",
    requiredAssay: "Direct Fluorescent Antibody (DFA) / Giardia Antigen ELISA",
    survivalProfile:
      "Hardy cyst wall provides high tolerance to acidic pH (down to 4.5) and resistance to conventional chlorination.",
    imageUrl:
      "https://images.openai.com/static-rsc-4/_H3JX3zCQgh50c9NU-pv8ncTeASfejNERXY4e-XhD9vk0aIntdcyyEQ7ikb6T0HLKjIu6NFLJAwYU53x9BSPZN0Hxxpo8Su5ajGERq2q0WMdQtdgYoLVta17gDRjI8_ywqcuylsklGNmIQTAVf7NIk5oxYQzBbIB5am7_9FpoLg?purpose=inline",
  },
  {
    id: "cryptosporidium",
    name: "Cryptosporidium",
    disease: "Cryptosporidiosis",
    category: "Protozoan parasite",
    vector: "Microscopic oocysts bypassing standard sediment filters",
    symptoms: "Profuse debilitating watery diarrhea, abdominal cramps, low-grade fever, weight loss.",
    requiredAssay: "Modified Acid-Fast Staining / Cryptosporidium PCR",
    survivalProfile:
      "Thick double-layered oocyst wall survives across broad pH ranges (4.5 to 9.0); completely impervious to free chlorine.",
    imageUrl:
      "https://images.openai.com/static-rsc-4/l-3ttYgHF3UmYIv--w28Tl8aM04jZXIKBhO-0FrWrijD4Y4pG4J0XlSvCAg-sawoPjybLWKouVPUI-e8NcISNZ77VxO_MOlV1kvdFN-ccQxKWtnFEXGLz-O9PSuRo45vJRiBE04vWGdn5Y5czC-bVYICL3IUcgIZ8q33JxbsY_s?purpose=inline",
  },
  {
    id: "shigella",
    name: "Shigella dysenteriae",
    disease: "Shigellosis",
    category: "Bacterial pathogen",
    vector: "Low-dose waterborne transmission (<100 bacterial cells)",
    symptoms: "Bloody mucoid diarrhea, severe rectal tenesmus, high fever, toxic megacolon risk.",
    requiredAssay: "XLD / Hektoen Agar Culture & Shigella Serotyping",
    survivalProfile:
      "Acid-resistance systems (GadAB/RpoS) allow survival through acidic water matrices (down to pH 4.5) and stomach acid barriers.",
    imageUrl:
      "https://images.openai.com/static-rsc-4/L10imZxlxfaQJHDVMrY4leCR8wgNrkd3fyXHpyguWGgDZYTlFYyYDZPXio4i0pA7EHnQmIGhUlU2SjPRjKt91k4fpGKhyeCvLkwUKwLuEjZ725NVLQ1JqMjng4x8n73nC3QGI69-qqEJE3I5B9wBHpcLyiUXPcfderkxVbXkBd4?purpose=inline",
  },
];

/**
 * Master library of infrastructure reference images illustrating piping and valve conditions.
 */
export const INFRASTRUCTURE_REFERENCE_IMAGES: InfrastructureReferenceImage[] = [
  {
    id: "hard_water_scale",
    title: "Scale-Forming Water & Hard Water",
    caption: "Mineral encrustation and calcium carbonate crystal deposits accumulating on inner pipe walls.",
    imageUrl:
      "https://images.openai.com/static-rsc-4/5j6KfrKHRXEUpRrXOxxYNG3HENNTbH8gpLXqa0oeF9JfdLXCMKqlVevQAcJK3hrjZ5ztUczpRYZvGckj9yWnA1ZXKcEHHOh1Klg8N-yXQq08pdISFiHkrJBFTqDp2zamENKtk1YOfHFPD5Yn10td5ewISd65XzlOlWkZZQlN5uw?purpose=inline",
  },
  {
    id: "corrosive_pipe",
    title: "Corrosive Water & Wall Degradation",
    caption: "Acidic water leaching plumbing metals (lead, copper), causing internal pitting and galvanic breakdown.",
    imageUrl:
      "https://images.openai.com/static-rsc-4/A8dJpcN9E5teeNcxarAmVyioh3vWtm-SWUNGQ02WndsFiYCju_JX6RkpzUISb83smePVnDAJyw44WtKa4FG5KEbxW1iseEIYz0AOybVXapvMSWNWzP1-xvg6XpRn1rlkqbDU42qIiVktMRBIEC3dpZgHmAxKTbtxY7GYyuoKel0?purpose=inline",
  },
  {
    id: "valve_sticking",
    title: "Valve Deposits & Diameter Constriction",
    caption: "Severe scale accumulation choking effective pipe diameter and sticking motorized solenoid valves.",
    imageUrl:
      "https://images.openai.com/static-rsc-4/OPs4KTKKFGsURmSBH8HeJ7uXY9nP2UAFIkBrqSljGvKZCtGSIvvSpdyYKoAKQXjO3zgmhnYGXg3fKnzPlcp6sbIZyDvEqkb6EwdU_puW_nRHk8zD7zdrIDCnOnz5Gz5KlTlpLtm9bHRt17pWNk-CYKLiRCxX0E9MT-GBD8TrPGA?purpose=inline",
  },
];

/**
 * Calculates risk level, styling, and scientific evaluation based on live pH and real TDS.
 */
export function getWaterQualityCorrelation(ph: number, tds: number): WaterQualityCorrelation {
  const isAcidic = ph < 6.5;
  const isStrongAcid = ph < 5.0;
  const isAlkaline = ph > 8.5;
  const isStrongAlkaline = ph > 9.2;
  const isNeutral = ph >= 6.5 && ph <= 8.5;

  const isHighTds = tds > 300;
  const isCriticalTds = tds > 500;
  const isModerateTds = tds > 150 && tds <= 300;

  // 1. Evaluate individual pathogen risk levels
  const evaluatedPathogens: PathogenEntry[] = TARGET_PATHOGENS_DEFINITIONS.map((def) => {
    let riskLevel: PathogenRiskLevel = "SAFE";
    let riskScore = 20;
    let riskReason = "Environmental baseline risk; standard disinfection barrier effective.";

    if (def.id === "vibrio") {
      if (isAlkaline || isStrongAlkaline) {
        riskLevel = "CRITICAL";
        riskScore = 92;
        riskReason =
          "Surges when high pH (8.0–9.2) eliminates hypochlorous acid disinfection. Highly alkaline-tolerant.";
      } else if (isStrongAcid) {
        riskLevel = "LOW";
        riskScore = 15;
        riskReason = "Acid-sensitive organism; rapidly inactivated at pH below 5.5.";
      } else if (isAcidic) {
        riskLevel = "LOW";
        riskScore = 25;
        riskReason = "Mildly acidic environment suppresses Vibrio growth kinetics.";
      } else {
        riskLevel = isHighTds ? "MODERATE" : "LOW";
        riskScore = isHighTds ? 50 : 20;
        riskReason = "Controlled by active chlorination in neutral potable range.";
      }
    } else if (def.id === "salmonella") {
      if (isAlkaline || isStrongAlkaline) {
        riskLevel = "HIGH";
        riskScore = 82;
        riskReason =
          "Prolonged survival in distribution mains when pipe scale impedes biocide contact and alkaline pH neutralizes chlorine.";
      } else if (isAcidic) {
        riskLevel = isHighTds ? "HIGH" : "MODERATE";
        riskScore = 55;
        riskReason = "Acidic stress slows Salmonella growth, but high TDS buffers bacterial cells.";
      } else {
        riskLevel = isHighTds ? "MODERATE" : "LOW";
        riskScore = isHighTds ? 40 : 15;
        riskReason = "Disinfection barrier effective in neutral potable water.";
      }
    } else if (def.id === "ecoli") {
      if (isAlkaline || isStrongAlkaline) {
        riskLevel = isCriticalTds ? "CRITICAL" : "HIGH";
        riskScore = 80;
        riskReason =
          "Bacterial survival elevated outside stability window; chlorine efficacy reduced by >80%.";
      } else if (isAcidic) {
        riskLevel = isHighTds ? "HIGH" : "MODERATE";
        riskScore = 60;
        riskReason =
          "Corrosive acidic water breach often coincides with organic runoff contamination.";
      } else {
        riskLevel = isCriticalTds ? "HIGH" : isHighTds ? "MODERATE" : "SAFE";
        riskScore = isCriticalTds ? 75 : isHighTds ? 45 : 10;
        riskReason = isCriticalTds
          ? "High TDS indicates possible sewage/fecal runoff breach."
          : "Optimal neutral drinking water suppresses fecal coliform survival.";
      }
    } else if (def.id === "giardia") {
      if (isAcidic || isStrongAcid) {
        riskLevel = "HIGH";
        riskScore = 80;
        riskReason =
          "Hardy cyst wall provides high tolerance to acidic pH (down to 4.5) and resistance to chlorine.";
      } else if (isAlkaline || isStrongAlkaline) {
        riskLevel = isHighTds ? "CRITICAL" : "HIGH";
        riskScore = 85;
        riskReason =
          "Chlorine biocide collapse combined with high cyst persistence elevates transmission risk.";
      } else {
        riskLevel = isHighTds ? "HIGH" : "MODERATE";
        riskScore = isHighTds ? 65 : 30;
        riskReason = isHighTds
          ? "Particulate sediment matrix facilitates cyst transport."
          : "Safe tap range; routine filtration prevents cyst transmission.";
      }
    } else if (def.id === "cryptosporidium") {
      if (isAcidic || isAlkaline || isHighTds) {
        riskLevel = "CRITICAL";
        riskScore = 95;
        riskReason =
          "Thick double-layered oocyst wall survives across broad pH 4.5–9.0 and is completely impervious to chlorine.";
      } else {
        riskLevel = "MODERATE";
        riskScore = 40;
        riskReason =
          "Standard membrane/sand barrier filtration required; oocysts survive baseline chlorine.";
      }
    } else if (def.id === "shigella") {
      if (isStrongAcid) {
        riskLevel = "HIGH";
        riskScore = 85;
        riskReason =
          "Acid-tolerant systems (GadAB/RpoS) allow survival through low pH matrices. Low infectious dose (<100 cells).";
      } else if (isAcidic) {
        riskLevel = isHighTds ? "HIGH" : "HIGH";
        riskScore = 75;
        riskReason = "Mildly acidic conditions preserve bacterial membrane integrity.";
      } else if (isAlkaline) {
        riskLevel = isHighTds ? "HIGH" : "MODERATE";
        riskScore = isHighTds ? 70 : 50;
        riskReason = "Biocide chlorine decay permits bacterial persistence.";
      } else {
        riskLevel = isHighTds ? "MODERATE" : "LOW";
        riskScore = isHighTds ? 45 : 15;
        riskReason = isHighTds
          ? "Suspended solids shield bacteria from standard disinfection."
          : "Within safe WHO/EPA baseline.";
      }
    }

    // Styling helpers
    const badgeClass = {
      CRITICAL: "bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm shadow-rose-500/20",
      HIGH: "bg-rose-500/15 text-rose-300 border border-rose-500/35",
      MODERATE: "bg-amber-500/15 text-amber-300 border border-amber-500/35",
      LOW: "bg-sky-500/15 text-sky-300 border border-sky-500/35",
      SAFE: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35",
    }[riskLevel];

    const color = {
      CRITICAL: "text-rose-400",
      HIGH: "text-rose-400",
      MODERATE: "text-amber-400",
      LOW: "text-sky-400",
      SAFE: "text-emerald-400",
    }[riskLevel];

    const dotColor = {
      CRITICAL: "bg-rose-500 animate-pulse",
      HIGH: "bg-rose-500",
      MODERATE: "bg-amber-400",
      LOW: "bg-sky-400",
      SAFE: "bg-emerald-400",
    }[riskLevel];

    return {
      ...def,
      riskLevel,
      riskScore,
      riskReason,
      color,
      badgeClass,
      dotColor,
    };
  });

  // 2. Synthesize Section 01: Sensor Observation & System Alert Matrix
  const sensorAlerts: SensorObservationAlert[] = [
    {
      id: "elevated_ph",
      observation: "Elevated pH",
      interpretation: "Can reduce effectiveness of chlorine disinfection",
      alert: "Disinfection efficiency concern",
      active: isAlkaline,
      tone: isAlkaline ? "danger" : "neutral",
    },
    {
      id: "low_ph",
      observation: "Low pH",
      interpretation: "Potential corrosivity and irritation concern",
      alert: "Acidic water anomaly",
      active: isAcidic,
      tone: isAcidic ? "danger" : "neutral",
    },
    {
      id: "elevated_tds",
      observation: "Elevated TDS",
      interpretation: "Dissolved-substance concentration anomaly",
      alert: "Mineral / dissolved-solids warning",
      active: isHighTds,
      tone: isHighTds ? "warning" : "neutral",
    },
    {
      id: "sudden_tds",
      observation: "Sudden TDS change",
      interpretation: "Possible change in water source or dissolved composition",
      alert: "Composition anomaly",
      active: tds > 400 || (tds > 250 && isAlkaline),
      tone: tds > 400 ? "warning" : "neutral",
    },
    {
      id: "abnormal_both",
      observation: "Abnormal pH + TDS",
      interpretation: "Multiple chemistry parameters outside their configured ranges",
      alert: "Combined anomaly",
      active: (isAcidic || isAlkaline) && isHighTds,
      tone: (isAcidic || isAlkaline) && isHighTds ? "danger" : "neutral",
    },
  ];

  // 3. Synthesize Section 03: Infrastructure & Pipe Impact Intelligence
  const infrastructureItems: InfrastructureImpactItem[] = [
    {
      id: "scale_forming",
      condition: "Scale-forming water",
      impact: "Mineral deposits on pipe walls",
      active: isAlkaline || (isNeutral && tds > 300),
      severity: isAlkaline && tds > 300 ? "danger" : isAlkaline ? "warning" : "neutral",
    },
    {
      id: "caco3_precip",
      condition: "Calcium carbonate precipitation",
      impact: "Scale accumulation under suitable chemical conditions",
      active: isAlkaline,
      severity: isAlkaline ? "warning" : "neutral",
    },
    {
      id: "scale_buildup",
      condition: "Scale buildup",
      impact: "Reduced effective pipe diameter",
      active: isAlkaline && isHighTds,
      severity: isAlkaline && isHighTds ? "danger" : "neutral",
    },
    {
      id: "valve_deposits",
      condition: "Deposits in valves",
      impact: "Reduced movement or possible sticking",
      active: isHighTds || isAlkaline,
      severity: isHighTds && isAlkaline ? "danger" : "warning",
    },
    {
      id: "corrosive_water",
      condition: "Corrosive water conditions",
      impact: "Increased corrosion risk in susceptible plumbing materials",
      active: isAcidic,
      severity: isAcidic ? "danger" : "neutral",
    },
  ];

  // 4. Synthesize What We Can Conclude
  let whatWeCanConclude = "Balanced potable water; parameters comply with safe drinking thresholds.";
  if (isStrongAcid) {
    whatWeCanConclude =
      "Strongly acidic water; high corrosive leaching risk. Elevated survival for acid-tolerant cysts (Giardia, Cryptosporidium).";
  } else if (isAcidic) {
    whatWeCanConclude =
      "Acidic water; potential corrosivity and irritation concern. Heavy metal leaching risk elevated.";
  } else if (isStrongAlkaline) {
    whatWeCanConclude =
      "Severely alkaline water; hypochlorous acid disinfection completely eliminated (>85% biocide loss). Critical Vibrio & Salmonella risk.";
  } else if (isAlkaline) {
    whatWeCanConclude =
      "Alkaline water; can reduce effectiveness of chlorine disinfection. High risk of calcium scale precipitation.";
  } else if (isHighTds) {
    whatWeCanConclude =
      "Elevated mineral / dissolved solids concentration anomaly; suspended solids can shield pathogens and coat distribution mains.";
  }

  // 5. Chemical Concern
  let chemicalConcern = "Optimal hydrochemical stability (EPA 6.5–8.5 standard).";
  let chemicalConcernColor = "text-emerald-400";
  if (isAcidic) {
    chemicalConcern = "Acidic pH Anomaly (Internal corrosion & heavy metal leaching: Lead, Copper, Zinc)";
    chemicalConcernColor = "text-rose-400";
  } else if (isAlkaline) {
    chemicalConcern = "High Alkalinity Anomaly (Caustic scaling & >80% free chlorine disinfection loss)";
    chemicalConcernColor = "text-purple-400";
  } else if (isHighTds) {
    chemicalConcern = `High Total Dissolved Solids (${tds.toFixed(1)} ppm; mineral encrustation and contamination load)`;
    chemicalConcernColor = "text-amber-400";
  }

  // 6. Infrastructure & Pipe Impact summary
  let infrastructureImpact = "Minimal corrosive or scaling strain on distribution mains.";
  if (isAcidic) {
    infrastructureImpact =
      "Corrosive water conditions: Internal pipe wall corrosion, pinhole pitting, and degradation of copper/brass fittings.";
  } else if (isAlkaline && isHighTds) {
    infrastructureImpact =
      "Scale-forming water: Heavy calcium carbonate accumulation, reduced effective pipe diameter, and sticking in motorized valves.";
  } else if (isAlkaline) {
    infrastructureImpact =
      "Calcium carbonate precipitation and gradual encrustation of pipe walls under alkaline conditions.";
  } else if (isHighTds) {
    infrastructureImpact =
      "Accelerated mineral sediment deposition in valves and potential galvanic pipe corrosion.";
  }

  // 7. Microbial Status
  let microbialStatus =
    "Controlled baseline (Disinfection barrier fully functional; standard potable water matrix).";
  if (isAcidic) {
    microbialStatus =
      "Not Tested (Specific microbe cannot be determined by electrochemical or conductivity metrics alone; acid-resistant cysts persist).";
  } else if (isAlkaline) {
    microbialStatus =
      "Disinfection Concern (Hypochlorous acid HOCl converted to inactive OCl⁻; biocide failure permits microbial resurgence).";
  } else if (isHighTds) {
    microbialStatus =
      "Suspended Shielding (Elevated dissolved/colloidal solids shield microorganisms from UV and chemical sanitizers).";
  }

  // 8. Protocol Recommendation
  let protocolRecommendation = "Maintain continuous IoT flow and telemetry monitoring.";
  if (isAcidic) {
    protocolRecommendation = "Further chemical neutralization and microbiological testing required.";
  } else if (isAlkaline) {
    protocolRecommendation =
      "Immediate pH neutralization (buffer/acid dosing) and verification of free residual chlorine.";
  } else if (isCriticalTds) {
    protocolRecommendation =
      "Reverse osmosis filtration, sediment pre-treatment, and accredited laboratory culture assay.";
  } else if (isHighTds) {
    protocolRecommendation = "Carbon/sediment filtration and monitoring for catchment runoff breach.";
  }

  // Overall risk computation
  const maxScore = Math.max(...evaluatedPathogens.map((p) => p.riskScore));
  let overallRisk: PathogenRiskLevel = "SAFE";
  if (maxScore >= 90) overallRisk = "CRITICAL";
  else if (maxScore >= 70) overallRisk = "HIGH";
  else if (maxScore >= 45) overallRisk = "MODERATE";
  else if (maxScore >= 25) overallRisk = "LOW";

  const scientificProtocol =
    "Scientific Protocol: pH and TDS indicate water chemical characteristics, not specific pathogens. Displayed microbes represent target surveillance organisms and biological survival probabilities based on environmental hydrochemistry. Formal pathogen confirmation requires accredited microbiological lab assays.";

  const chlorineDisinfectionDetail =
    "Chlorine disinfection depends on pH. As pH rises, the proportion of chlorine present as hypochlorous acid (HOCl), generally the more effective disinfecting form, decreases as it shifts toward hypochlorite (OCl⁻). However, HYDRAXX cannot calculate actual disinfection effectiveness from pH alone without chlorine measurements and other operating conditions.";

  return {
    assessedPh: ph,
    assessedTds: tds,
    overallRisk,
    overallScore: maxScore,
    whatWeCanConclude,
    chemicalConcern,
    chemicalConcernColor,
    infrastructureImpact,
    microbialStatus,
    protocolRecommendation,
    scientificProtocol,
    chlorineDisinfectionDetail,
    sensorAlerts,
    infrastructureItems,
    infrastructureImages: INFRASTRUCTURE_REFERENCE_IMAGES,
    pathogens: evaluatedPathogens,
  };
}
