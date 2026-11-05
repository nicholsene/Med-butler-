export type ContactMatch = { type: 'email' | 'phone' | 'contact link'; match: string };
export function findContactPatterns(text: string): ContactMatch[];
export function scrubContactDetails(text: string): string;
