// Shared source of truth for "has this person filled in the fields we now
// require" — used by AuthContext/ProtectedRoute to gate the app, and mirrors
// (must be kept in sync with) the `required: true` fields in
// pages/Profile.tsx's OVERVIEW_FIELDS / EMERGENCY_CONTACT_FIELDS and the
// inline validation in its FamilyCard. Takes the raw Onboarding document
// (camelCase Mongoose field names), same shape buildProfileFromOnboarding
// in Profile.tsx maps from.
const filled = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';

export function isProfileComplete(doc: any): boolean {
  if (!doc) return true; // no onboarding record linked to this account yet — nothing to gate on

  const required = [
    doc.name, doc.nationality, doc.address, doc.birthday, doc.bloodGroup, doc.maritalStatus,
    doc.persEmail, doc.mobile,
    doc.emergencyContactName, doc.emergencyContactRelation, doc.emergencyContactPhone, doc.emergencyContactPlace,
    doc.familyFather, doc.familyFatherOccupation, doc.familyMother, doc.familyMotherOccupation,
    doc.familyNumberOfChildren,
  ];
  if (doc.maritalStatus === 'Married') {
    required.push(doc.familySpouse, doc.familySpouseOccupation);
  }
  return required.every(filled);
}
