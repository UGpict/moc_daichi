/** Places Photo (New) の resource name だけを許可する。外部の任意URLは拒否する。 */
const PLACES_PHOTO = /^places\/[A-Za-z0-9_-]+\/photos\/[^/]+$/;
const MOCK_PHOTO = /^mock:[a-z0-9-]+$/;

export function parsePlacesPhotoName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const name = raw.trim();
  if (name.includes("..") || name.includes("://") || name.includes("\\")) return null;
  if (PLACES_PHOTO.test(name) || MOCK_PHOTO.test(name)) return name;
  return null;
}

export function vibeFromCategories(categories: string[], subject: "SELF" | "PARTNER"): string {
  const blob = categories.join(" ").toLowerCase();
  if (/(cafe|bakery|sweet)/.test(blob)) return subject === "PARTNER" ? "甘いもの" : "カフェ";
  if (/(museum|art_gallery)/.test(blob)) return "展示";
  if (/(park|tourist_attraction)/.test(blob)) return subject === "PARTNER" ? "のんびり" : "散歩";
  return "今回の候補";
}
