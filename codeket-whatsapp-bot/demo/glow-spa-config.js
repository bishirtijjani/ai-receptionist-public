/**
 * Demo spa config: Example Spa
 * Used for live demos and testing. Mirrors the hero conversation on the landing page.
 * In production, spa configs live in Supabase (spa_configs table).
 */

export const example-spaSpaConfig = {
  id: "example-spa",
  name: "Example Spa",
  city: "Austin",
  state: "TX",
  address: "1240 South Congress Ave, Suite 4, Austin, TX 78704",
  phone: "(512) 555-0182",
  website: "https://example-spamedspa.example.com",
  hours: {
    monday: "9 AM - 6 PM",
    tuesday: "9 AM - 6 PM",
    wednesday: "9 AM - 7 PM",
    thursday: "9 AM - 7 PM",
    friday: "9 AM - 6 PM",
    saturday: "10 AM - 4 PM",
    sunday: "Closed",
  },
  bookingSystem: "Calendly",
  medicalDirector: "Dr. Aisha Okonkwo, MD (Board-Certified Dermatologist)",
  team: [
    "Dr. Aisha Okonkwo, MD — Medical Director",
    "Lauren Mercer, NP — Lead Injector",
    "Priya Shah — Licensed Aesthetician",
  ],
  services: [
    {
      name: "Botox",
      description: "Neuromodulator injections for wrinkle relaxation (forehead, crow's feet, glabella, etc.)",
      price: "$13 per unit, typical session $300-650",
      duration: "30 min",
    },
    {
      name: "Lip Filler",
      description: "Juvederm Ultra or Volbella for lip augmentation and definition",
      price: "$650 first visit, $750 returning",
      duration: "45 min including 20-min consult",
    },
    {
      name: "Cheek / Facial Filler",
      description: "Juvederm Voluma or Restylane Lyft for midface volume and contouring",
      price: "$750 per syringe",
      duration: "45-60 min",
    },
    {
      name: "Laser Hair Removal",
      description: "Candela GentleMax Pro. Full legs, underarms, bikini, face available.",
      price: "Full legs $250/session, 6-session package $1,200. Underarms $100/session. Bikini $150/session.",
      duration: "30-60 min depending on area",
    },
    {
      name: "HydraFacial",
      description: "3-step skin resurfacing, extraction, and hydration. Add-ons: booster serums available.",
      price: "Signature $175, Deluxe $225, Platinum $275",
      duration: "30-60 min",
    },
    {
      name: "Chemical Peel",
      description: "VI Peel or ZO Stimulator Peel for texture, tone, and pigmentation.",
      price: "$175-325 depending on peel depth",
      duration: "30 min",
    },
    {
      name: "Microneedling",
      description: "SkinPen microneedling for collagen induction. Face only or face + neck.",
      price: "$350 face only, $425 face + neck",
      duration: "60 min",
    },
    {
      name: "Morpheus8",
      description: "RF microneedling for skin tightening and body contouring.",
      price: "$800 per session, package of 3 for $2,100",
      duration: "60-90 min",
    },
    {
      name: "Free Consultation",
      description: "15-min consult with our injector or aesthetician to discuss your goals and build a treatment plan.",
      price: "Free",
      duration: "15 min",
    },
  ],
  policies: {
    depositRequired: true,
    depositAmount: "$100 deposit required to hold all appointments. Applied toward service.",
    cancellationPolicy:
      "Cancel or reschedule at least 24 hours in advance to avoid losing your deposit. Same-day cancellations forfeit the deposit.",
    newClientIntake:
      "New clients complete a medical intake form sent by email after booking. Please complete it before your appointment.",
    paymentMethods: ["Visa", "Mastercard", "Amex", "Apple Pay", "Zelle", "Cash"],
    hipaaNote:
      "We do not discuss specific medical history, treatment suitability, or before/after details over WhatsApp. Those conversations happen with your provider in clinic.",
  },
};
