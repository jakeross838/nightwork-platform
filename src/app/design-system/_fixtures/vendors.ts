// Sample vendors for the design-system playground (Stage 1.5a T19.5).
//
// Pure constants. No imports from @/lib/supabase|org|auth (per SPEC C6 / D9).
// All vendor names are FICTIONAL — Florida-coastal-builder-flavored — and
// MUST NOT match any real Ross Built vendor. The T35.6 grep check rejects
// the reference job + reference vendor + reference city names verbatim;
// we steer well clear of that surface area by using fully invented
// vendor names below.

export type SampleVendor = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  default_cost_code_id: string | null;
};

export const SAMPLE_VENDORS: SampleVendor[] = [
  {
    id: "v-coastal-carpentry",
    name: "Coastal Carpentry Co.",
    address: "1418 Bayshore Dr, St. Petersburg, FL 33704",
    phone: "(727) 555-0181",
    email: "billing@coastalcarpentry.example",
    default_cost_code_id: "cc-06101", // Framing — Rough Carpentry
  },
  {
    id: "v-bayside-plumbing",
    name: "Bayside Plumbing Inc.",
    address: "9302 Manasota Key Rd, Englewood, FL 34223",
    phone: "(941) 555-0204",
    email: "ar@baysideplumbing.example",
    default_cost_code_id: "cc-10101", // Plumbing — Rough
  },
  {
    id: "v-pelican-drywall",
    name: "Pelican Drywall Services",
    address: "4220 Tamiami Trail, Sarasota, FL 34233",
    phone: "(941) 555-0167",
    email: "office@pelicandrywall.example",
    default_cost_code_id: "cc-15101", // Drywall — Hang & Finish
  },
  {
    id: "v-sunrise-electric",
    name: "Sunrise Electric & Solar",
    address: "8504 SW 22nd Ave, Cape Coral, FL 33914",
    phone: "(239) 555-0153",
    email: "ap@sunriseelectric.example",
    default_cost_code_id: "cc-09101", // Electrical — Rough
  },
  {
    id: "v-mangrove-hvac",
    name: "Mangrove HVAC Mechanical",
    address: "2178 Bonita Beach Rd, Bonita Springs, FL 34134",
    phone: "(239) 555-0188",
    email: "billing@mangrovehvac.example",
    default_cost_code_id: "cc-12101", // HVAC
  },
  {
    id: "v-tarpon-cabinets",
    name: "Tarpon Custom Cabinets",
    address: "517 Old Tampa St, Tarpon Springs, FL 34689",
    phone: "(727) 555-0139",
    email: "shop@tarponcabinets.example",
    default_cost_code_id: "cc-15401", // Cabinetry & Built-ins
  },
  {
    id: "v-osprey-painting",
    name: "Osprey Painting & Coatings",
    address: "3361 N. Tamiami Trail, Osprey, FL 34229",
    phone: "(941) 555-0192",
    email: "billing@ospreypaint.example",
    default_cost_code_id: "cc-15501", // Painting & Coatings
  },
  {
    id: "v-shoreline-concrete",
    name: "Shoreline Concrete Co.",
    address: "8205 16th St E, Manatee, FL 34221",
    phone: "(941) 555-0148",
    email: "ap@shorelineconcrete.example",
    default_cost_code_id: "cc-05101", // Concrete / Foundation
  },
  {
    id: "v-redfish-trim",
    name: "Redfish Trim & Millwork",
    address: "6712 Gulf Of Mexico Dr, Longboat Key, FL 34228",
    phone: "(941) 555-0173",
    email: "office@redfishtrim.example",
    default_cost_code_id: "cc-15301", // Trim & Millwork
  },
  {
    id: "v-gulfside-architects",
    name: "Gulfside Architects PA",
    address: "402 Pine Ave, Anna Maria, FL 34216",
    phone: "(941) 555-0117",
    email: "studio@gulfsidearchitects.example",
    default_cost_code_id: "cc-01101", // Architectural Services
  },
];
