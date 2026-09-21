// Static cover data for the landing page (docs/claude-code-spec-landing.md).
// Hand-picked from the default shelf so the page paints with no Supabase round trip
// and no dependency on games.json. URLs are the raw BGG CDN strings: always pass
// them through sizedCover() from /js/shelf-data.js before putting them in an <img>.

/** The five cards the visitor swipes in the hero, in deal order. Also the games the story screens show. */
export const LANDING_GAMES = [
  {
    "bggId": "295947",
    "title": "Cascadia",
    "image": "https://cf.geekdo-images.com/MjeJZfulbsM1DSV3DrGJYA__original/img/B374C04Eip7fmQBGJzgiOTp-jyQ=/0x0/filters:format(jpeg)/pic5100691.jpg"
  },
  {
    "bggId": "178900",
    "title": "Codenames",
    "image": "https://cf.geekdo-images.com/nC6ifPCDnAItwoKSKXVrnw__original/img/Id-jjIer_61ZbvI2_RVRCeBZFY4=/0x0/filters:format(jpeg)/pic8907965.jpg"
  },
  {
    "bggId": "148228",
    "title": "Splendor",
    "image": "https://cf.geekdo-images.com/MZvNcL5AZoBS6of9Pv2BjA__original/img/z6jTSwhyGDqR69HNkSbGQql3VG4=/0x0/filters:format(jpeg)/pic2524282.jpg"
  },
  {
    "bggId": "30549",
    "title": "Pandemic",
    "image": "https://cf.geekdo-images.com/3vBX9OLgJWknYu2Fy2lWdw__original/img/WDFmYRRJ8HpXt1E2vvZb1OEPjs8=/0x0/filters:format(jpeg)/pic8233136.jpg"
  },
  {
    "bggId": "254640",
    "title": "Just One",
    "image": "https://cf.geekdo-images.com/uRVY_4287U7moXhgQcWLvg__original/img/eDiRjb-ghxTG_YM6LN1w2AxrR2o=/0x0/filters:format(jpeg)/pic4912588.jpg"
  },
  {
    "bggId": "342942",
    "title": "Ark Nova",
    "image": "https://cf.geekdo-images.com/SoU8p28Sk1s8MSvoM4N8pQ__itemrep@2x/img/Pr8zSaMINlALYjR0agud0_EFESs=/fit-in/492x600/filters:strip_icc()/pic6293412.jpg"
  },
  {
    "bggId": "163412",
    "title": "Patchwork",
    "image": "https://cf.geekdo-images.com/RDOwMRBnIb3Ehl6GyXj9xg__original/img/iVl8KAZ8JMmDXsnBqQecFRkOhK8=/0x0/filters:format(jpeg)/pic8669620.jpg"
  },
  {
    "bggId": "237182",
    "title": "Root",
    "image": "https://cf.geekdo-images.com/JUAUWaVUzeBgzirhZNmHHw__itemrep@2x/img/ws8Cu10dtH9Dk0bzuc4xHmIKDEc=/fit-in/492x600/filters:strip_icc()/pic4254509.jpg"
  },
  {
    "bggId": "262543",
    "title": "Wavelength",
    "image": "https://cf.geekdo-images.com/z4fbPdmJg_5yphJEvql4ZA__original/img/bP1gM8RC-o5iz20_WazBaBNDHnU=/0x0/filters:format(png)/pic4552862.png"
  },
  {
    "bggId": "225694",
    "title": "Decrypto",
    "image": "https://cf.geekdo-images.com/X6HDeg8AhGXGhB8je65MTw__original/img/A2cgVhqNzUMUGg7_GJ5omWcdkt8=/0x0/filters:format(jpeg)/pic7303572.jpg"
  }
];

/** Thirty covers for the hero's cover wall and the closing section's floor. Decorative only. */
export const LANDING_WALL = [
  "https://cf.geekdo-images.com/JUrmY8GgFPQlENiPT7BGZw__original/img/whCMdZhta-uXHgNJfVnetnjZueU=/0x0/filters:format(jpeg)/pic6884563.jpg",
  "https://cf.geekdo-images.com/aSwGrv9uvfRyBymlHJ-B8w__original/img/cHP3bhVFkJepWSfjWKBR-talnDc=/0x0/filters:format(jpeg)/pic6731109.jpg",
  "https://cf.geekdo-images.com/SoU8p28Sk1s8MSvoM4N8pQ__itemrep@2x/img/Pr8zSaMINlALYjR0agud0_EFESs=/fit-in/492x600/filters:strip_icc()/pic6293412.jpg",
  "https://cf.geekdo-images.com/bOs_Um4cUUOpKnypCMykJA__original/img/RE_9_-ioTp31Fq_r5GZ_XKVGwzw=/0x0/filters:format(png)/pic8844519.png",
  "https://cf.geekdo-images.com/7SrPNGBKg9IIsP4UQpOi8g__original/img/GKueTbkCk2Ramf6ai8mDj-BP6cI=/0x0/filters:format(jpeg)/pic4325841.jpg",
  "https://cf.geekdo-images.com/DCLgJlrvB-EqL6A3WgQLMQ__original/img/vGpYcxjDBCOVcI0BcWOevspTQMQ=/0x0/filters:format(jpeg)/pic5715770.jpg",
  "https://cf.geekdo-images.com/HINb2nkFn5IiZxAlzQIs4g__itemrep@2x/img/f8s-g70BViz6Thkzu5_jYoGf8BA=/fit-in/492x600/filters:strip_icc()/pic7009391.jpg",
  "https://cf.geekdo-images.com/kjCm4ZvPjIZxS-mYgSPy1g__itemrep@2x/img/-avAay86cuC29LAZVlTE84r5SSA=/fit-in/492x600/filters:strip_icc()/pic7013651.jpg",
  "https://cf.geekdo-images.com/i7n6LkRIskDq1438AgO0VA__original/img/TN6iOwF4cCaGnNyK61R9E_uXXrU=/0x0/filters:format(jpeg)/pic7437242.jpg",
  "https://cf.geekdo-images.com/t4fIRE_dryAV9eFFH1pfPw__original/img/HWiGfzBUGW9tbdtSvmhwsivn2y0=/0x0/filters:format(png)/pic8472819.png",
  "https://cf.geekdo-images.com/M0e9l-SHH2H4RMSAcnsDgg__original/img/nT1NtVviWxSBgVv5lvM4RmemITs=/0x0/filters:format(jpeg)/pic8658546.jpg",
  "https://cf.geekdo-images.com/Zz_iJ2cr4kS4jgT_pFw27g__original/img/Qybhex8ea62HVk6RAaqiDHH5BN8=/0x0/filters:format(png)/pic8652703.png",
  "https://cf.geekdo-images.com/oSM_AuKYfGIwOtKbVEsoVg__original/img/7DlaMCmuoJzm9AzelmStYIDgutI=/0x0/filters:format(png)/pic4503733.png",
  "https://cf.geekdo-images.com/e6QPQ_JaSSy-R1c2bJkYXA__original/img/wNhou5aff1JGRJF_ppcTVD66ZQc=/0x0/filters:format(jpeg)/pic7889099.jpg",
  "https://cf.geekdo-images.com/7CFgBadtCNf5Mzi1nsrL2Q__original/img/Iv0VzhyEa74-sGfbtt9nwrRKZlw=/0x0/filters:format(jpeg)/pic5822480.jpg",
  "https://cf.geekdo-images.com/reK4-IeMo2T6HMnACMkmGw__original/img/MlkgXfMGT1IdIzwy3Sj2Ul45b4o=/0x0/filters:format(png)/pic7710928.png",
  "https://cf.geekdo-images.com/MaeErIfx2AbLjmpmLwD-qQ__large/img/jw3MDqU9CNfvvWxXlENl7Ob-APM=/fit-in/1024x1024/filters:no_upscale():strip_icc()/pic8975321.jpg",
  "https://cf.geekdo-images.com/KWzepkM_pNKLOCdDDJLg0g__original/img/gTkkZV8qMZ2p4IxzFBVqnOeCb0w=/0x0/filters:format(jpeg)/pic6535570.jpg",
  "https://cf.geekdo-images.com/pDiHT-n1xpW71Ck_wiR8_g__original/img/pho_viNg1Jk28LoXbMkTTvVHOIw=/0x0/filters:format(png)/pic7375477.png",
  "https://cf.geekdo-images.com/GeswS76PRQQV0TUvNdUGew__original/img/U2DZO2y6vsJPabsjpGID0HeEpAE=/0x0/filters:format(jpeg)/pic4788657.jpg",
  "https://cf.geekdo-images.com/h1dXXGGcCjaGdCip6Q_oGQ__itemrep@2x/img/Z_ktul2p0wcyZ_6MiDknQJ-gviw=/fit-in/492x600/filters:strip_icc()/pic6786604.jpg",
  "https://cf.geekdo-images.com/1XA2-niwTBa0HEB7hOz3Dw__original/img/MIJgG_K2IS1QT2mE0dyRFiWLSpg=/0x0/filters:format(jpeg)/pic4530974.jpg",
  "https://cf.geekdo-images.com/gBPzZsgm9nrUYVfdK216NA__itemrep@2x/img/I7lESA5b_RNSWN27orgv02GlepY=/fit-in/492x600/filters:strip_icc()/pic4557340.png",
  "https://cf.geekdo-images.com/DvvSoTrB3-UMEgz2rBraHg__original/img/a70U9DGHGxiyo8WWMOb9Zd4hrxc=/0x0/filters:format(jpeg)/pic7533289.jpg",
  "https://cf.geekdo-images.com/y7Rqd3S6J7vyVhicR1bqTQ__original/img/tQFXv1w2R-J-1cjyaKG9LAS2UOs=/0x0/filters:format(jpeg)/pic6091101.jpg",
  "https://cf.geekdo-images.com/co36SqyPYlM1QwVW6XSwyQ__original/img/ErbrDNguZzKtnCCAUiQCh1xwldc=/0x0/filters:format(jpeg)/pic8933083.jpg",
  "https://cf.geekdo-images.com/cf0xxkevbwTGF3VUZymKjg__original/img/vkElrRCPJxy7Q3TH9olpq20egA4=/0x0/filters:format(png)/pic6398727.png",
  "https://cf.geekdo-images.com/tyv6lPMlyU7YIUztlILQYQ__itemrep@2x/img/lQMHypGthw9PcbLsx2hiBK2n4V4=/fit-in/492x600/filters:strip_icc()/pic8587890.png",
  "https://cf.geekdo-images.com/v_BidaaTXux6j_UJQol6Jw__original/img/RDmxiiYALGFFD3ElKLTlR5C5xa8=/0x0/filters:format(jpeg)/pic8918996.jpg",
  "https://cf.geekdo-images.com/F-J1_JTJMhg_71RFfDAe4w__original/img/v8kYC6F9MEOzXRraUKQCywAbhdk=/0x0/filters:format(png)/pic8766964.png"
];
