const hebrew: Record<string, string> = {
  "Food & dining": "אוכל ומסעדות",
  Groceries: "מצרכים",
  Transport: "תחבורה",
  Shopping: "קניות",
  Housing: "דיור",
  Health: "בריאות",
  Entertainment: "בילויים",
  Salary: "משכורת",
  Freelance: "עבודה עצמאית",
  Other: "אחר",
  food: "אוכל",
  transport: "תחבורה",
  shopping: "קניות",
  bills: "חשבונות",
  entertainment: "בילויים",
  salary: "משכורת",
  other: "אחר",
};
export function categoryLabel(category: string, he: boolean) {
  return he ? hebrew[category] || category : category;
}
