// Work location is derived from department, not stored per employee: R&D,
// Engineering, Production, and Manufacturing sit at Sector 80; every other
// department is at Sector 63. Matched by keyword (not exact name) since
// department names in Role Master vary in spelling/casing (e.g. "R & D",
// "Manufacturing Unit").
const SECTOR_80_KEYWORDS = ["r&d", "r & d", "research", "engineering", "production", "manufactur"];

function resolveWorkLocation(dept) {
  const d = String(dept || "").trim().toLowerCase();
  const isSector80 = SECTOR_80_KEYWORDS.some((kw) => d.includes(kw));
  return isSector80 ? "Noida Sector 80" : "Noida Sector 63";
}

module.exports = resolveWorkLocation;
