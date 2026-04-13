import { Badge } from "@/components/ui/badge";

export const RELATIONSHIP_LABELS: Record<string, string> = {
  SPOUSE: "Spouse",
  FATHER: "Father",
  MOTHER: "Mother",
  SON: "Son",
  DAUGHTER: "Daughter",
  BROTHER: "Brother",
  SISTER: "Sister",
  FATHER_IN_LAW: "Father-in-law",
  MOTHER_IN_LAW: "Mother-in-law",
  SON_IN_LAW: "Son-in-law",
  DAUGHTER_IN_LAW: "Daughter-in-law",
  GRANDFATHER: "Grandfather",
  GRANDMOTHER: "Grandmother",
  GRANDSON: "Grandson",
  GRANDDAUGHTER: "Granddaughter",
  UNCLE: "Uncle",
  AUNT: "Aunt",
  NEPHEW: "Nephew",
  NIECE: "Niece",
  COUSIN: "Cousin",
  GUARDIAN: "Guardian",
  OTHER: "Other",
};

interface RelationshipBadgeProps {
  relationship: string;
  otherRelationship?: string | null;
}

export function RelationshipBadge({ relationship, otherRelationship }: RelationshipBadgeProps) {
  const label =
    relationship === "OTHER" && otherRelationship?.trim()
      ? otherRelationship
      : (RELATIONSHIP_LABELS[relationship] ?? relationship);

  return (
    <Badge variant="secondary" className="text-xs font-medium">
      {label}
    </Badge>
  );
}
