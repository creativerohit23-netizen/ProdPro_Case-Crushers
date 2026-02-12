const contentTypeSelect = document.getElementById("contentType");
const fileInput = document.getElementById("fileInput");
const textInput = document.getElementById("textInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const clearBtn = document.getElementById("clearBtn");
const resultCard = document.getElementById("resultCard");
const resultContent = document.getElementById("resultContent");
const closeBtn = document.getElementById("closeBtn");
const errorMessage = document.getElementById("errorMessage");

contentTypeSelect.addEventListener("change", handleContentTypeChange);
analyzeBtn.addEventListener("click", analyzeContent);
clearBtn.addEventListener("click", clearForm);
closeBtn.addEventListener("click", hideResults);

function handleContentTypeChange() {
  const value = contentTypeSelect.value;
  fileInput.hidden = value === "text";
  textInput.hidden = value !== "text";
  fileInput.value = "";
  textInput.value = "";
  clearError();
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.classList.remove("hidden");
}

function clearError() {
  errorMessage.textContent = "";
  errorMessage.classList.add("hidden");
}

function clearForm() {
  fileInput.value = "";
  textInput.value = "";
  clearError();
  hideResults();
}

function hideResults() {
  resultCard.classList.add("hidden");
}

function analyzeContent() {
  clearError();
  const type = contentTypeSelect.value;

  if (type === "text") {
    const text = textInput.value.trim();
    if (!text) {
      showError("Please enter text to analyze");
      return;
    }
    const signals = analyzeText(text);
    displayResults([{ type: "TEXT", signals }]);
  } else {
    const file = fileInput.files[0];
    if (!file) {
      showError("Please select a " + type + " file");
      return;
    }
    
    let signals;
    if (type === "image") signals = analyzeImage(file);
    else if (type === "video") signals = analyzeVideo(file);
    else if (type === "audio") signals = analyzeAudio(file);

    if (signals) displayResults([{ type: type.toUpperCase(), signals }]);
  }
}

function analyzeImage(file) {
  const fileName = file.name.toLowerCase();
  const fileSize = file.size;
  const fileType = file.type;
  
  // Check for explicit AI tool markers (strongest indicator)
  const hasAIMarkers = fileName.includes("chatgpt") || fileName.includes("midjourney") || 
                       fileName.includes("dall-e") || fileName.includes("ai_generated") ||
                       fileName.includes("stable") || fileName.includes("generator") ||
                       fileName.includes("openai") || fileName.includes("replicate");
  
  // Check for real photo indicators
  const isScreenshot = fileName.includes("screenshot") || fileName.includes("screen shot") ||
                       fileName.includes("screencap") || fileName.includes("snap") ||
                       fileName.includes("screen grab") || fileType === "image/bmp";
  
  // Check for personal/casual photo indicators
  const isPersonalPhoto = fileName.includes("friend") || fileName.includes("family") || 
                          fileName.includes("me") || fileName.includes("selfie") || 
                          fileName.includes("person") || fileName.includes("portrait") ||
                          fileName.includes("profile") || fileName.includes("pic");
  
  // File format analysis
  const isJPEG = fileType === "image/jpeg";
  const isPNG = fileType === "image/png";
  const isWebP = fileType === "image/webp";
  
  // File size patterns
  const isVerySmallFile = fileSize < 80000;    // Suspicious for real photos
  const isLargeFile = fileSize > 1500000;      // Typical for real photos
  const isMediumFile = fileSize > 300000 && fileSize < 1500000;  // Real photo range
  const isSmallFile = fileSize < 300000;       // Suspicious file size
  
  // Filename analysis - look for signs of authenticity
  const hasNoGenericName = !(/^image[_-]?\d+|^photo[_-]?\d+|^unnamed|^img[_-]?\d+|^picture[_-]?\d+/i.test(fileName));
  const hasMultipleWords = (fileName.match(/[a-z]{3,}/gi) || []).length > 1;
  
  // Check for photorealistic indicators (very strict)
  const hasPhotorealKeywords = fileName.includes("photo") || fileName.includes("real") || 
                               fileName.includes("camera") || fileName.includes("canon") ||
                               fileName.includes("nikon") || fileName.includes("sony");
  const hasRealCameraFormat = isJPEG && isLargeFile;
  
  // Visual characteristics detection through pixel analysis
  let visualAIScore = 0;
  try {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, Math.min(100, img.width), Math.min(100, img.height));
      const data = imageData.data;
      
      // Detect AI artifacts: check for unnatural smoothness and symmetry
      let smoothness = 0;
      let colorConsistency = 0;
      let pixelVariance = 0;
      
      for (let i = 0; i < data.length - 4; i += 4) {
        const r1 = data[i], g1 = data[i+1], b1 = data[i+2];
        const r2 = data[i+4], g2 = data[i+5], b2 = data[i+6];
        const diff = Math.sqrt((r1-r2)*(r1-r2) + (g1-g2)*(g1-g2) + (b1-b2)*(b1-b2));
        if (diff < 10) smoothness++;
        colorConsistency += diff;
      }
      
      smoothness /= (data.length / 4);
      if (smoothness > 0.85) visualAIScore += 0.4; // Too smooth = AI indicator
    };
    img.src = URL.createObjectURL(file);
  } catch (e) {
    // Fallback if canvas analysis fails
  }
  
  // Calculate composite score with weighted factors
  let aiScore = 0;
  let weightSum = 0;
  
  // AI Markers (strongest weight)
  if (hasAIMarkers) {
    aiScore += 0.95 * 4;
    weightSum += 4;
  } else {
    aiScore += 0.05 * 4;
    weightSum += 4;
  }
  
  // File format (JPEG = real camera) - HEAVY WEIGHT
  if (isJPEG) {
    aiScore += 0.15 * 3;
    weightSum += 3;
  } else if (isPNG || isWebP) {
    // PNG/WebP are common for AI-generated images, memes, graphics
    aiScore += 0.75 * 4;
    weightSum += 4;
  }
  
  // File size (large/medium files suggest real photos)
  if (isLargeFile) {
    aiScore += 0.10 * 2;
    weightSum += 2;
  } else if (isMediumFile) {
    // Medium size PNG = common for AI-generated images
    aiScore += 0.65 * 3;
    weightSum += 3;
  } else if (isSmallFile) {
    // Very small files = high compression or AI-generated
    aiScore += 0.75 * 3;
    weightSum += 3;
  } else if (isVerySmallFile) {
    aiScore += 0.85 * 3;
    weightSum += 3;
  }
  
  // Personal/casual indicators - EXTREMELY strict requirements
  if (hasRealCameraFormat && hasPhotorealKeywords && isLargeFile) {
    // Only trust if ALL three strict conditions are met (JPEG + "photo" keyword + large file)
    aiScore += 0.05 * 3;
    weightSum += 3;
  } else if (hasRealCameraFormat && isLargeFile) {
    // Real camera format + large file (but no explicit "photo" keyword)
    aiScore += 0.15 * 2;
    weightSum += 2;
  } else if (isPersonalPhoto && isJPEG) {
    // Personal keywords + JPEG, but size/quality unknown
    aiScore += 0.35 * 2;
    weightSum += 2;
  } else if (!isScreenshot) {
    // Unknown/generic image - assume AI unless proven otherwise
    aiScore += 0.70 * 3;
    weightSum += 3;
  } else {
    // Screenshot detected
    aiScore += 0.05 * 2;
    weightSum += 2;
  }
  
  // Filename authenticity - STRONG penalty for generic/suspicious names
  if (hasNoGenericName && hasMultipleWords && (fileName.length > 15)) {
    // Descriptive, multi-word filename with good length = likely authentic
    aiScore += 0.15 * 2;
    weightSum += 2;
  } else if (hasNoGenericName && hasMultipleWords) {
    // Multi-word but short name
    aiScore += 0.40 * 2;
    weightSum += 2;
  } else if (hasNoGenericName) {
    // Custom name but single word
    aiScore += 0.55 * 2;
    weightSum += 2;
  } else {
    // Generic/auto-generated names = much higher AI likelihood
    aiScore += 0.75 * 2;
    weightSum += 2;
  }
  
  // Screenshot detection
  if (isScreenshot) {
    aiScore += 0.05 * 2;
    weightSum += 2;
  }
  
  const finalScore = Math.round((aiScore / weightSum) * 100);
  
  const scores = {
    "AI Tool Markers": { 
      score: hasAIMarkers ? 0.95 : 0.05, 
      description: hasAIMarkers ? "Filename indicates AI tool" : "No AI markers"
    },
    "Format & Type": { 
      score: isJPEG ? 0.1 : (isPNG ? 0.65 : (isWebP ? 0.60 : 0.5)), 
      description: isJPEG ? "JPEG (camera source)" : (isPNG ? "PNG (common for AI/graphics)" : "Other format")
    },
    "File Size": { 
      score: isLargeFile ? 0.1 : (isMediumFile ? 0.55 : (isSmallFile ? 0.70 : 0.80)), 
      description: "Size: " + (fileSize / 1000).toFixed(0) + "KB - " + (isLargeFile ? "typical camera photo" : (isMediumFile ? "common for AI-generated" : "suspicious compression"))
    },
    "Source Authenticity": { 
      score: (hasRealCameraFormat && hasPhotorealKeywords) ? 0.05 : (!isScreenshot ? 0.60 : 0.05), 
      description: (hasRealCameraFormat && hasPhotorealKeywords) ? "Camera photo indicators" : (!isScreenshot ? "Generic/AI-suspicious" : "Screenshot format")
    },
    "Filename Analysis": { 
      score: (hasNoGenericName && hasMultipleWords && fileName.length > 15) ? 0.15 : (hasNoGenericName && hasMultipleWords ? 0.35 : (hasNoGenericName ? 0.50 : 0.70)), 
      description: (hasNoGenericName && hasMultipleWords && fileName.length > 15) ? "Authentic descriptive name" : (hasNoGenericName ? "Custom single-word name" : "Generic/auto-generated name")
    }
  };
  
  return scores;
}

function analyzeText(text) {
  if (text.length < 30) {
    return { "Length": { score: 0.5, description: "Text too short for analysis" } };
  }

  // Split into sentences
  const sents = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  
  // 1. SENTENCE LENGTH UNIFORMITY (AI uses very consistent lengths)
  const sentLengths = sents.map(s => s.trim().split(/\s+/).length);
  const avgLen = sentLengths.reduce((a,b) => a+b, 0) / sentLengths.length;
  const variance = sentLengths.reduce((a,b) => a + Math.pow(b-avgLen,2), 0) / sentLengths.length;
  const uniformityScore = variance < 15 ? 0.75 : (variance < 30 ? 0.4 : 0.15);
  
  // 2. CORPORATE/FORMAL PHRASES (AI loves these!)
  const corporatePhrases = [
    'important part', 'many companies', 'improve efficiency', 'reduce costs',
    'enhance decision', 'large amounts', 'provide insights', 'continue to',
    'must learn', 'integrate', 'maintain', 'essential', 'crucial',
    'business needs', 'modern organization', 'continue to develop',
    'responsible', 'maintain ethical', 'decision-making'
  ];
  const textLower = text.toLowerCase();
  const corporateCount = corporatePhrases.filter(p => textLower.includes(p)).length;
  const corporateScore = (corporateCount / corporatePhrases.length) > 0.4 ? 0.80 : 
                         (corporateCount > 0 ? 0.5 : 0.1);
  
  // 3. AI CLICHÉ PHRASES (Almost 100% AI indicator)
  const aiCliches = [
    'ai tools', 'artificial intelligence', 'continues to', 'responsibly',
    'ethical standard', 'enhance', 'efficiency', 'insights',
    'technology develop', 'learn how to', 'important role'
  ];
  const clicheCount = aiCliches.filter(p => textLower.includes(p)).length;
  const clicheScore = (clicheCount / aiCliches.length) > 0.3 ? 0.85 : 
                      (clicheCount > 1 ? 0.65 : 0.2);
  
  // 4. PASSIVE VOICE (AI overuses passive construction)
  const passiveMatches = text.match(/\b(is|are|be|being|been)\s+\w+(ed|ing)\b/gi);
  const passiveCount = passiveMatches ? passiveMatches.length : 0;
  const passiveScore = (passiveCount / sents.length) > 1.5 ? 0.70 : 
                       (passiveCount / sents.length) > 0.5 ? 0.45 : 0.1;
  
  // 5. VOCABULARY DIVERSITY (AI can have high diversity but repetitive phrases)
  const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
  const diversity = uniqueWords / wordCount;
  const repetitionScore = diversity > 0.7 ? 0.1 : (diversity > 0.5 ? 0.3 : 0.6);
  
  // 6. TRANSITION WORD OVERUSE (AI uses too many connectors)
  const transitionWords = ['however', 'moreover', 'furthermore', 'therefore',
                          'consequently', 'additionally', 'notably', 'particularly',
                          'essentially', 'clearly', 'obviously', 'importantly'];
  const transitionCount = transitionWords.filter(t => textLower.includes(t)).length;
  const transitionScore = transitionCount > 2 ? 0.70 : (transitionCount > 0 ? 0.3 : 0.05);
  
  // 7. SUPERLATIVES & HEDGING (AI uses many of these)
  const hedgeWords = ['important', 'significant', 'crucial', 'essential',
                      'key', 'critical', 'vital', 'major', 'potential',
                      'appear to', 'seem to', 'may', 'might', 'could'];
  const hedgeCount = hedgeWords.filter(h => textLower.includes(h)).length;
  const hedgeScore = hedgeCount > 5 ? 0.75 : (hedgeCount > 2 ? 0.55 : 0.15);
  
  // WEIGHTED COMPOSITE SCORE
  let totalScore = 0;
  let totalWeight = 0;
  
  // Apply weights (higher weight = more important)
  totalScore += uniformityScore * 3;
  totalWeight += 3;
  
  totalScore += corporateScore * 3;
  totalWeight += 3;
  
  totalScore += clicheScore * 4;  // Highest weight - most reliable AI indicator
  totalWeight += 4;
  
  totalScore += passiveScore * 2;
  totalWeight += 2;
  
  totalScore += repetitionScore * 2;
  totalWeight += 2;
  
  totalScore += transitionScore * 2;
  totalWeight += 2;
  
  totalScore += hedgeScore * 2;
  totalWeight += 2;
  
  const finalScore = (totalScore / totalWeight);
  
  return {
    "Sentence Uniformity": { 
      score: uniformityScore, 
      description: "Variance: " + variance.toFixed(1) + " (AI tends <15)",
      weight: 3
    },
    "Corporate Phrases": { 
      score: corporateScore, 
      description: "Found " + corporateCount + "/" + corporatePhrases.length + " corporate terms",
      weight: 3
    },
    "AI Clichés": { 
      score: clicheScore, 
      description: "Found " + clicheCount + "/" + aiCliches.length + " typical AI phrases (STRONGEST indicator)",
      weight: 4
    },
    "Passive Voice": { 
      score: passiveScore, 
      description: passiveCount + " instances - AI avg: 1-2+ per sentence",
      weight: 2
    },
    "Formal Hedging": { 
      score: hedgeScore, 
      description: hedgeCount + " hedge/superlative words (AI: 5+)",
      weight: 2
    },
    "Transition Words": { 
      score: transitionScore, 
      description: transitionCount + " connectors found",
      weight: 2
    },
    "_FINAL_WEIGHTED_SCORE": {
      score: finalScore,
      description: "Weighted composite",
      weight: 0
    }
  };
}

function analyzeVideo(file) {
  const size = file.size < 5000000 ? 0.6 : 0.3;
  return {
    "Size": { score: size, description: (file.size / 1000000).toFixed(1) + "MB" },
    "Smoothness": { score: 0.4, description: "Cannot detect in browser" },
    "Consistency": { score: 0.3, description: "Requires video processing" }
  };
}

function analyzeAudio(file) {
  const size = file.size < 1000000 ? 0.5 : 0.2;
  return {
    "Quality": { score: 0.4, description: "Cannot analyze in browser" },
    "Size": { score: size, description: (file.size / 1000000).toFixed(1) + "MB" },
    "Patterns": { score: 0.3, description: "Requires audio processing" }
  };
}

function displayResults(analyses) {
  let html = "";
  for (let i = 0; i < analyses.length; i++) {
    const a = analyses[i];
    const score = calcScore(a.signals);
    const risk = getRisk(score);
    
    html += '<div class="analysis-result">';
    html += '<div class="result-title">' + a.type + '</div>';
    html += '<div class="ai-score ' + risk.cls + '">';
    html += '<div class="score-value">' + score + '%</div>';
    html += '<div class="risk-label">' + risk.lbl + '</div>';
    html += '</div>';
    html += '<div class="signals-list">';
    
    for (const key in a.signals) {
      // Skip internal scoring metadata
      if (key.startsWith('_')) continue;
      
      const d = a.signals[key];
      html += '<div class="signal-item">';
      html += '<div class="signal-name">' + key + '</div>';
      html += '<div class="signal-bar"><div class="signal-fill" style="width:' + (d.score*100) + '%"></div></div>';
      html += '<div class="signal-description">' + d.description + '</div>';
      html += '</div>';
    }
    html += '</div></div>';
  }
  
  html += '<div class="result-footer"><p>Disclaimer: Demo tool. May have false positives.</p></div>';
  resultContent.innerHTML = html;
  resultCard.classList.remove("hidden");
}

function calcScore(signals) {
  // Check if this is a text analysis with weighted scoring
  if (signals._FINAL_WEIGHTED_SCORE) {
    return Math.round(signals._FINAL_WEIGHTED_SCORE.score * 100);
  }
  
  // For image/video/audio, use weighted calculation if weights are present
  const keys = Object.keys(signals).filter(k => !k.startsWith('_'));
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const key of keys) {
    const sig = signals[key];
    if (sig.weight !== undefined) {
      totalScore += sig.score * sig.weight;
      totalWeight += sig.weight;
    }
  }
  
  // If weights exist, use weighted average; otherwise use simple average
  if (totalWeight > 0) {
    return Math.round((totalScore / totalWeight) * 100);
  } else {
    const scores = keys.map(k => signals[k].score);
    const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
    return Math.round(avg * 100);
  }
}

function getRisk(score) {
  if (score >= 70) return { lbl: "High Risk", cls: "high-risk" };
  if (score >= 40) return { lbl: "Medium Risk", cls: "medium-risk" };
  return { lbl: "Low Risk", cls: "low-risk" };
}
