curl -X POST http://localhost:3000/create-campaign \
  -H "Content-Type: application/json" \
  -d @- <<'JSON'
{
  "offer_summary": "Fill up with Shell V-Power twice this summer and enjoy 500 bonus GO+ points.",
  "mechanic": "Activate in GO+ → Fill up with Shell V-Power ≥30L on two separate visits → Scan app/card/key fob → Get 500 bonus points.",
  "timing_window": "10 June – 31 August 2025",
  "targeting": "GO+ members in Premium/V-Power segment; Quality Believers, Road Warriors, Spontaneous Indulgers.",
  "creative_direction": "Hero image of a UK family or friends loading a car for a trip, bright summer tones, Costa iced drink in shot, Shell forecourt backdrop. Light sunshine flare for optimism.",
  "cta": {
    "text": "Activate now",
    "url": "PLACEHOLDER"
  },
  "legal": "UK GO+ members only. Activation required before qualifying purchases. Min. 30L Shell V-Power per transaction. Two qualifying purchases required between 10/06/25 – 31/08/25. Points awarded within 14 days after second purchase. Participating stations only. Full T&Cs apply.",
  "email_template": {
    "subject_line": "Earn 500 bonus points for your summer road trips",
    "preheader": "Fuel twice with Shell V-Power and make your adventures even more rewarding.",
    "body": "Drive into summer with extra rewards\n\n{{member_name}}, summer’s calling. Make the most of every journey with Shell V-Power — and we’ll add 500 bonus GO+ points to your account.\n\nWhy Shell V-Power this summer?\n• Keeps your engine performing at its best\n• Protects against gunk and corrosion\n• Designed to get the most out of every mile\n\nHow it works:\n1) Activate the offer in Shell GO+\n2) Fill up with ≥30L Shell V-Power on two separate visits between 10 June – 31 August 2025\n3) Scan your GO+ app, card or key fob each time\n4) Receive 500 bonus points within 14 days\n\nPrimary CTA: Activate now (PLACEHOLDER)\nSecondary CTA: Find your nearest station (PLACEHOLDER)\n\nHelps to maintain engine performance when compared to ordinary fuels. UK GO+ members only. Activation required before qualifying purchases. Minimum 30L Shell V-Power per transaction. Two qualifying purchases must be made between 10/06/25 and 31/08/25. Bonus points awarded within 14 days after second purchase. Points have no cash value. Participating stations only. See full T&Cs here."
  },
  "design_notes": "Use Shell Yellow/Red 4:1 ratio on white; warm, natural lighting; friendly type hierarchy; avoid over-clutter.",
  "production_notes": "Replace CTA placeholders with live GO+ activation and station finder URLs. Ensure imagery meets UK vehicle/forecourt compliance (RHD, UK plates, diverse cast). Maintain HSSE compliance — no in-car phone use, refuelling shown safely.",
  "country": "UK",
  "product": "Shell V-Power",
  "assets": {
    "Hero": {
      "prompt": "UK family/friends loading car with luggage, summer sunshine, Shell station in background, Costa iced drink in foreground.",
      "alt_text": "Family preparing for summer road trip at Shell"
    },
    "Secondary image": {
      "prompt": "Close-up pump shot of Shell V-Power nozzle and digital screen with points icon overlay.",
      "alt_text": "Shell V-Power pump nozzle close-up"
    },
    "Product mosaic": {
      "prompt": "3-frame strip — open road with blue sky, Shell V-Power pump, GO+ app scan moment.",
      "alt_text": "Shell GO+ app scanning at till"
    }
  }
}
JSON