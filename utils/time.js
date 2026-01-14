function parseLooseTime(raw) {
  if (!raw || typeof raw !== 'string') return null;
  
  const cleaned = raw.trim().replace(/[^\d:]/g, '');
  
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    if (parts.length !== 2) return null;
    
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    
    return { h, m };
  }
  
  if (cleaned.length === 0) return null;
  
  if (cleaned.length === 1 || cleaned.length === 2) {
    const h = parseInt(cleaned);
    if (h < 0 || h > 23) return null;
    return { h, m: 0 };
  }
  
  if (cleaned.length === 3) {
    const h = parseInt(cleaned.substring(0, 1));
    const m = parseInt(cleaned.substring(1, 3));
    
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    
    return { h, m };
  }
  
  if (cleaned.length === 4) {
    const h = parseInt(cleaned.substring(0, 2));
    const m = parseInt(cleaned.substring(2, 4));
    
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    
    return { h, m };
  }
  
  return null;
}

function formatTime(parsed) {
  if (!parsed || typeof parsed.h === 'undefined' || typeof parsed.m === 'undefined') return null;
  
  const h = String(parsed.h).padStart(2, '0');
  const m = String(parsed.m).padStart(2, '0');
  
  return `${h}:${m}`;
}

function normalizeTimeInput(raw) {
  const parsed = parseLooseTime(raw);
  if (!parsed) return null;
  return formatTime(parsed);
}

function validateTimeRange(start, end) {
  if (!start || !end) return false;
  
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  
  return endMins > startMins;
}

module.exports = {
  parseLooseTime,
  formatTime,
  normalizeTimeInput,
  validateTimeRange
};
