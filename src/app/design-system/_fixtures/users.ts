// Sample users for the design-system playground (Stage 1.5a T19.5).
//
// Pure constants. No imports from @/lib/supabase|org|auth (per SPEC C6 / D9).
// FICTIONAL names only — must NOT match the real Ross Built team (no Jake
// Ross, no Andrew Ross, no Lee Ross, no Diane / Mara / Cindy / Lee Worthy /
// Nelson Belanger / Bob Mozine / Jeff Bryde / Martin Mannix / Jason
// Szykulski). Names below are "Sarah Reilly / Mark Henderson / Jenna Ortiz"
// type per the task brief.

export type SampleUserRole = "admin" | "accounting" | "pm" | "owner";

export type SampleUser = {
  id: string;
  full_name: string;
  email: string;
  role: SampleUserRole;
  initials: string; // for avatar usage in playground
};

export const SAMPLE_USERS: SampleUser[] = [
  // Admins (2)
  {
    id: "u-mark-henderson",
    full_name: "Mark Henderson",
    email: "m.henderson@example.com",
    role: "admin",
    initials: "MH",
  },
  {
    id: "u-priya-sandhu",
    full_name: "Priya Sandhu",
    email: "p.sandhu@example.com",
    role: "admin",
    initials: "PS",
  },

  // Accounting (3)
  {
    id: "u-jenna-ortiz",
    full_name: "Jenna Ortiz",
    email: "j.ortiz@example.com",
    role: "accounting",
    initials: "JO",
  },
  {
    id: "u-celia-morgan",
    full_name: "Celia Morgan",
    email: "c.morgan@example.com",
    role: "accounting",
    initials: "CM",
  },
  {
    id: "u-anya-rovira",
    full_name: "Anya Rovira",
    email: "a.rovira@example.com",
    role: "accounting",
    initials: "AR",
  },

  // PMs (4)
  {
    id: "u-tessa-vance",
    full_name: "Tessa Vance",
    email: "t.vance@example.com",
    role: "pm",
    initials: "TV",
  },
  {
    id: "u-derek-shaw",
    full_name: "Derek Shaw",
    email: "d.shaw@example.com",
    role: "pm",
    initials: "DS",
  },
  {
    id: "u-rohan-patel",
    full_name: "Rohan Patel",
    email: "r.patel@example.com",
    role: "pm",
    initials: "RP",
  },
  {
    id: "u-naomi-britt",
    full_name: "Naomi Britt",
    email: "n.britt@example.com",
    role: "pm",
    initials: "NB",
  },

  // Owner (1)
  {
    id: "u-elliot-glass",
    full_name: "Elliot Glass",
    email: "e.glass@example.com",
    role: "owner",
    initials: "EG",
  },
];
