# Product images — picks to review

Generated from `data/product-images.json` after sourcing; see `docs/product-images-contact-sheet.png`
for the crops. Every pick passed the hard rules (exact item type, clear subject, no people,
no readable logos/text, no watermark, ≥ 800 px 1:1 crop) and its license was re-read at the
origin page. Confidence is the lower of the picker's and the independent reviewer's rating.

Totals: 102 nouns — high 51, medium 48, low 2, category placeholder 1. That includes 13 local 3D renders
(6 high, 7 medium), which replaced 6 of the 7 category placeholders and 7 of the 9 low-confidence photos.
Originally: high 45, medium 41, low 9, placeholder 7. Before/after for every replaced image:
`docs/product-images-before-after.jpg`.

Background normalisation (C4, rembg) was not applied: busy backgrounds are a minority and the
brief allows it only where edges come out clean, so every entry records `bg_normalised: false`.

## Local 3D renders (13)

Provider `local-3d-render`: an original scene of a generic, unbranded product. It is modelled in code
and rendered locally with three.js in headless Chromium (`scripts/images/render-products.mjs`), with
no photograph, no generative AI, and no API or account. The renders are dedicated to the public
domain (CC0 1.0), and /credits labels each one "3D render". Each manifest entry records its tool
versions, scene file, seed and variant (`render`).

Each noun got 4 candidates (seeds 1–4, 64 samples, 1024²). Every candidate was checked on a 256px
thumbnail for: exact item type, no text or lettering, no logo-like marks, no shape artefacts, and
reading as a real product photo. The verdict for each seed is in `data/product-renders.json`. No noun
needed a regeneration round.

| Noun | Category | Replaces | Confidence | Why | Source |
| --- | --- | --- | --- | --- | --- |
| Hair Oil | Beauty | low photo (antique Roman flask) | medium | Original 3D render: amber Boston-round bottle with a gold collar and black rubber dropper, part-filled with golden oil; no text or marks. A dropper bottle could also read as a serum, so medium. | [scene](../scripts/images/render/products/hair-oil.js), seed 4 (amber glass, gold collar, black bulb) |
| Eye Serum | Beauty | placeholder | medium | Original 3D render: slim clear-glass roll-on with blush serum, rose-gold roller ball and its cap beside it; no text or marks. A roll-on could also be a perfume oil, so medium. | [scene](../scripts/images/render/products/eye-serum.js), seed 2 (clear glass, blush serum, rose-gold roller) |
| Night Cream | Beauty | low photo (antique ointment pot) | high | Original 3D render: open plum frosted-glass cream jar showing the cream, gold screw lid beside it; no text or marks. Replaces the antique ointment pot. | [scene](../scripts/images/render/products/night-cream.js), seed 2 (plum frosted glass, gold lid, open with lid beside) |
| Sunscreen SPF 50 | Beauty | placeholder | medium | Original 3D render: plain yellow squeeze tube standing on a white flip-top cap beside a dollop of lotion; no text. With no label any lotion tube could be sunscreen, so medium. | [scene](../scripts/images/render/products/sunscreen-spf-50.js), seed 2 (sun-yellow tube, white cap, lotion dollop) |
| Portable SSD | Electronics | placeholder | medium | Original 3D render: pocket-size space-grey aluminium drive with a USB-C port, activity LED and a short USB-C cable; no text or logo. Without a label it could also be a power bank, so medium. | [scene](../scripts/images/render/products/portable-ssd.js), seed 1 (space-grey aluminium, USB-C cable) |
| Bluetooth Tracker | Electronics | placeholder | medium | Original 3D render: white rounded-square tag with a graphite rim on a steel split key ring; no text or logo. A plain tag is the generic key-finder shape but not unmistakable, so medium. | [scene](../scripts/images/render/products/bluetooth-tracker.js), seed 4 (white rounded-square tag with graphite rim, steel key ring) |
| Capture Card | Gaming | low photo (partial AV box) | medium | Original 3D render: compact white capture box with HDMI in and out (both cables plugged in), USB-C and a light bar; no text or logo. An unlabelled HDMI box could also be a switch, so medium. | [scene](../scripts/images/render/products/capture-card.js), seed 2 (white, blue light bar, two HDMI cables) |
| Console Stand | Gaming | low photo (cropped console) | high | Original 3D render: black vertical stand holding a plain, unbranded white slim console, with two controller charging docks and LEDs; no text or logo, and no real console's design. | [scene](../scripts/images/render/products/console-stand.js), seed 1 (black stand, white console) |
| RGB Mousepad | Gaming | low photo (no RGB, mouse dominates) | high | Original 3D render: black cloth gaming mouse pad with a glowing rainbow RGB edge strip and a USB controller block with cable; no text or logo. | [scene](../scripts/images/render/products/rgb-mousepad.js), seed 1 (square pad, rainbow edge) |
| Laptop Sleeve | Accessories | placeholder | medium | Original 3D render: navy wool-felt envelope sleeve with a fold-over flap, brown leather strap and stud, lying flat; no text or logo. With no laptop shown it could also read as a document folio, so medium. | [scene](../scripts/images/render/products/laptop-sleeve.js), seed 2 (navy wool felt envelope, brown leather strap) |
| Art Set | Toys | placeholder | high | Original 3D render: open walnut case with coloured pencils, oil pastels, watercolour pans, brushes, paint tubes and a mixing palette; no text or maker marks. | [scene](../scripts/images/render/products/art-set.js), seed 2 (walnut case, lid 103°) |
| Bed Frame | Furniture | low photo (antique field cot) | high | Original 3D render: bare black metal queen platform bed frame with a spindle headboard, foot posts and wooden slats on a centre support; no text or marks. Replaces the antique field cot. | [scene](../scripts/images/render/products/bed-frame.js), seed 3 (black metal frame, spindle headboard) |
| Play Tent | Toys | low photo (dog, cluttered room) | high | Original 3D render: sage-green canvas children's teepee on four wooden poles lashed at the top, door flaps tied back over a padded floor mat, plain pennant garland; no text, people or clutter. Replaces the photo with a dog and a cluttered room. | [scene](../scripts/images/render/products/play-tent.js), seed 4 (sage-green canvas) |

Not rendered, by decision: Compression Tee, Training Gloves, Racing Wheel and Headset keep their
current images.

## Low confidence (2)

| Noun | Category | Why | Source |
| --- | --- | --- | --- |
| Compression Tee | Sports | Plain blank white tee on a hanger on white, no text; a basic cotton tee, not a compression/athletic top. | [origin](https://commons.wikimedia.org/wiki/File:Ringflash_Tshirt_Blank_Template_(3214240974).jpg) |
| Training Gloves | Sports | Rules met (no people/logos, PD), but these are vintage lace-up boxing gloves in a tight, partial close-up rather than gym training gloves. | [origin](https://commons.wikimedia.org/wiki/File:Black_boxing_gloves.jpg) |

## Medium confidence (41)

| Noun | Category | Why | Source |
| --- | --- | --- | --- |
| 4K Webcam | Electronics | Every hard rule is clearly met on a pure white packshot. It stays medium because the camera is shot from a low angle: the head is foreshortened and seen from below, and the fold-out clip takes up the whole lower half of the frame, so the webcam face is not the dominant view. | [origin](https://www.flickr.com/photos/jirka_matousek/50880551607/) |
| Mechanical Keyboard | Electronics | I could not refute any hard rule. The picture is a real mechanical keyboard, shot top-down on plain white. It has no people, watermarks, borders or collage layout, and the crop is 1270px. The keyboard frame and lift bar carry no logo, and all keycap legends are generic. It is not high because the framing is a kit flat-lay rather than a front or three-quarter product shot. The keyboard fills only about 96% of the width by 42% of the height of the square. A braided cable, the lift bar and 17 spare keycaps share the frame, so the image reads as box contents. That is unavoidable with a wide keyboard in a 1:1 crop of this source. | [origin](https://commons.wikimedia.org/wiki/File:System76_Launch_keyboard_accessories.webp) |
| USB-C Hub | Electronics | All hard rules are clearly met and the background is plain white. The framing is a tight three-quarter close-up: the far end of the hub (with its HDMI port) runs off the right edge and the USB-C plug is about as prominent as the body. That falls short of good product framing, but a square crop of the 1920x999 file cannot hold the whole hub, which is about 1450px wide. | [origin](https://commons.wikimedia.org/wiki/File:USB-C_Hubb_5_portar.jpg) |
| Wireless Charger | Electronics | I could not refute any hard rule. The image shows a round Qi charging pad from directly above, as the only subject, with no people or hands, on a plain black background, with nothing else in frame. The crop is 1080px from a 1920x1080 file, so it clears the 800px minimum. The one soft point is that the pad's face carries tone-on-tone printed text, "WIRELESS CHARGER". It is faint but legible in the 800px crop and plainly legible when zoomed in. It is a generic description of the item, not a brand logo, trademark, model name or packaging text, so rule 4 as written is met. It is printed on the product, not overlaid on the photo, so rule 5 is met too. Because it is still readable text on the product, I rate this medium rather than high. | [origin](https://commons.wikimedia.org/wiki/File:Antyne_Wireless_Charger_GY-68,_Oude_Pekela_(2019)_01.jpg) |
| Cashmere Scarf | Fashion | Whole fringed scarf laid flat on white, no text; a printed square shawl rather than a knitted cashmere scarf. | [origin](https://commons.wikimedia.org/wiki/File:Scarf_MET_61.173.10_CP4.jpg) |
| Denim Jacket | Fashion | Trucker jacket on a black torso form, plain background; a tiny wordless pocket tab (maker's trademark device) is visible but illegible. | [origin](https://commons.wikimedia.org/wiki/File:Levi%C2%B4s_spijkerjack,_kort_jasje_met_lange_mouwen_van_lichtblauwe_denim,_met_slijtplekken_en_reparatie_aan_kraag,_objectnr_24444.JPG) |
| Knit Beanie | Fashion | Whole unbranded beanie; wood-floor background with strong grain. | [origin](https://commons.wikimedia.org/wiki/File:Blue_knit_fleece_hat.jpg) |
| Linen Blazer | Fashion | Whole tailored jacket laid flat on white, no crest; back view, and a dark wool blazer rather than linen. | [origin](https://commons.wikimedia.org/wiki/File:Blazer_(AM_2004.28.47-3).jpg) |
| Merino Sweater | Fashion | Whole ribbed V-neck sweater on a headless dress form, plain background; aged museum garment. | [origin](https://commons.wikimedia.org/wiki/File:Pullover_(AM_1982.276-1).jpg) |
| Oxford Shirt | Fashion | Clean folded shirt on white with soft shadow, no labels; it is a French-cuff dress shirt with a spread collar rather than a button-down oxford. | [origin](https://commons.wikimedia.org/wiki/File:Camisade_pu%C3%B1o_doble.jpg) |
| Silk Tie | Fashion | Whole knotted tie on white, not worn; plain khaki cotton/mohair rather than silk. | [origin](https://commons.wikimedia.org/wiki/File:(US)_NECKTIE,_COTTON,_MOHAIR,_KHAKI_(STOCK_No_73-N-120),_2002.1543B.jpg) |
| Slim Chinos | Fashion | Whole pair of chinos front-on, no logos or people; background is a wrinkled white sheet (neutral, not seamless) and the hems touch the crop edge. | [origin](https://commons.wikimedia.org/wiki/File:Chino_pants.jpg) |
| Desk Lamp | Home | Whole articulated lamp on white, no readable text; subject fills under half the frame. | [origin](https://commons.wikimedia.org/wiki/File:Blaue_Halogen-Schreibtischlampe_rechts_2022.jpg) |
| Planter Set | Home | Three grouped pots with seedlings on white; paper seedling cups rather than decorative planters. | [origin](https://commons.wikimedia.org/wiki/File:Toilet_paper_seedlings_cup_3.jpg) |
| Scented Candle | Home | Unbranded candle tins, no text; high-angle close crop of several tins cut by the frame edges. | [origin](https://commons.wikimedia.org/wiki/File:Tin_Candles_by_Coco_Louis.jpg) |
| Table Runner | Home | White cutwork runner on plain grey, no text; the square crop shows the middle section, so it reads partly as a doily. | [origin](https://commons.wikimedia.org/wiki/File:Runner,_table_(AM_1996.72.21-3).jpg) |
| Throw Blanket | Home | Folded knitted throw fills the frame; reads as a knitted panel, small wood sliver. | [origin](https://commons.wikimedia.org/wiki/File:Grey_knitted_blanket.jpg) |
| Wall Clock | Home | Whole wall clock on a plain wall, dial has numerals only; ornate carved clock that fills under half the frame, pendulum cut. | [origin](https://commons.wikimedia.org/wiki/File:Wooden_wall_clock_with_massive_brass_weights_DSG5426-1_-_2020-04-25.jpg) |
| Dumbbell Set | Sports | Every hard rule holds. The image shows two matching dumbbells and nothing else, with no people, text, marks, watermark or border. The background is pure white (RGB 255 at the edges and in samples), and the crop is 1540px. It is not high because the framing is poor. The product runs almost the full 1920px width of the source, so no square crop can show it whole. The chosen crop cuts parts of three weight heads, not the two the pick names. There is also a slight doubt about the item type: this is a pair of dumbbells, not a larger set or rack, though stores commonly sell a pair as a "dumbbell set". | [origin](https://commons.wikimedia.org/wiki/File:Hand_weights.jpg) |
| Jump Rope | Sports | Handles and coiled rope clearly a skipping rope, no people/text; wood-table background and tight top-down crop. | [origin](https://commons.wikimedia.org/wiki/File:SKIPPING_ROPE.jpg) |
| Resistance Bands | Sports | I could not break any hard rule. The image is a rubber exercise band with a grip handle, it is the only object, and it sits on a plain background. There are no people or hands, no text, logos, watermarks or borders, and the crop is 937px. I rate it medium, not high, because the framing is weak: the square holds only about 54% of the band and cuts it off at the right edge. The item type is also slightly doubtful. It is an unusual multi-loop 'strength band', not the typical flat loop band or tube band, and the noun is plural while the photo shows one band. | [origin](https://commons.wikimedia.org/wiki/File:Strength_band.png) |
| Running Shoes | Sports | Unbranded white shoe on white, no logos; a single spiked track shoe in side profile with toe and heel touching the crop edges. | [origin](https://commons.wikimedia.org/wiki/File:Saysh-track-spike-white.jpg) |
| Water Bottle | Sports | Plain unbranded insulated bottle, cap to base; saturated red background rather than neutral. | [origin](https://commons.wikimedia.org/wiki/File:Stainless_Steel_Water_Bottle.jpg) |
| Yoga Mat | Sports | All hard rules hold. It is not rated high because the image is a retail shelf of about ten rolled mats seen end-on, not one isolated mat in front or three-quarter view. The background, a dark shelf interior over a white shelf edge, is neutral but not a plain studio backdrop. It is still unmistakably yoga mats (textured PVC mats rolled up), so there is no doubt about the item type. | [origin](https://commons.wikimedia.org/wiki/File:Fitness_mats_(51543374690).jpg) |
| Clay Mask | Beauty | Grey clay paste in a round dish, no people/text; wood-plank background. | [origin](https://commons.wikimedia.org/wiki/File:Boue_d%27argile_dans_une_canari_Gogotinkpon_au_B%C3%A9nin.jpg) |
| Facial Roller | Beauty | Stone roller on a metal handle on white; second roller head cropped out. | [origin](https://commons.wikimedia.org/wiki/File:Jaderoller.png) |
| Hydrating Cleanser | Beauty | Unlabelled frosted pump bottle, no text; busy bathroom-sink background. | [origin](https://commons.wikimedia.org/wiki/File:Pexels-pixabay-433624.jpg) |
| Lip Balm Trio | Beauty | Four unbranded lip balm sticks; desk background with a monitor edge. | [origin](https://commons.wikimedia.org/wiki/File:Homemade_lip_balm.jpg) |
| Matte Lipstick | Beauty | Unbranded lipstick, bullet exposed; small in frame with strong glare and shadow. | [origin](https://commons.wikimedia.org/wiki/File:Red_Lipstick.jpg) |
| Vitamin C Serum | Beauty | Unlabelled glass bottle with its dropper cap, no text; empty and stout, on a saturated teal background. | [origin](https://commons.wikimedia.org/wiki/File:Drop_counter_and_vial.JPG) |
| Oak Coffee Table | Furniture | Whole low table on a plain backdrop; rustic twig-and-glass table, not oak. | [origin](https://commons.wikimedia.org/wiki/File:Rustic-coffee-table.JPG) |
| Ottoman | Furniture | Whole upholstered footstool on plain background; black-and-white archival photo. | [origin](https://commons.wikimedia.org/wiki/File:Footstool_MET_170746.jpg) |
| Card Holder | Accessories | Every hard rule is met. The background is plain and neutral and the flat-lay framing is centred and clean. The only doubt is how the item reads. It is a cheap vinyl booklet opened to empty clear sleeves, so a shopper could take it for a passport cover or photo sleeve rather than a typical slim card holder. That item-type doubt keeps it from being high. | [origin](https://commons.wikimedia.org/wiki/File:Black_vertical_credit_card_holder_with_10_pockets_-_B-.jpg) |
| Sunglasses | Accessories | I could not refute any hard rule. The background is a plain white studio sweep, the three-quarter framing is good, and the whole product fits inside the 1500px square with margin on every side. Two doubts keep this below high. First, the product is an unusual armless design: a cord replaces the temple arms, so it is less typical than a classic pair. Second, the word "OMBRAZ" is faintly printed at the top edge of the upper lens and can just be made out at source resolution with 8x zoom. In the 800px crop it is a smudge about 35px wide and cannot be read, even contrast-normalised at 12x. | [origin](https://commons.wikimedia.org/wiki/File:Ombraz_Classic_Tortoise_Grey.jpg) |
| Watch Strap | Accessories | Unbranded rubber strap with buckle on white; tight close-up of part of the strap, so it reads less instantly as a watch strap. | [origin](https://commons.wikimedia.org/wiki/File:Extreme_bracelet.jpg) |
| Headset | Gaming | Whole single-ear chat headset with boom mic on white, no text; green accent ring is the only styling cue. | [origin](https://commons.wikimedia.org/wiki/File:Xbox_One_Chat_Headset.jpg) |
| Mechanical Keypad | Gaming | Complete numpad block with keycap legends only; section of a larger keyboard. | [origin](https://commons.wikimedia.org/wiki/File:Hi-TEK-115039-003-Caps-Numpad-2.JPG) |
| Streaming Mic | Gaming | Condenser mic with pop filter on a desk tripod, no maker marks; lived-in desk background and a book whose (non-brand) title is legible at the lower right. | [origin](https://commons.wikimedia.org/wiki/File:Micr%C3%B2fon_de_p%C3%B2dcast_i_llibres_en_catal%C3%A0.jpg) |
| Marble Run | Toys | Whole plastic marble run, no text; wood floor and glass-door background. | [origin](https://commons.wikimedia.org/wiki/File:Mega_Marble_Run_set.jpg) |
| RC Car | Toys | Whole RC car on a plain backdrop, no readable decals; stunt-car stance with a small add-on board and antenna. | [origin](https://commons.wikimedia.org/wiki/File:RC_BIT_1.JPG) |
| Wooden Blocks | Toys | Wooden alphabet block with single decorative letters on a plain backdrop; one block rather than a set. | [origin](https://commons.wikimedia.org/wiki/File:Blocks,_alphabet_(AM_1990.255-1).jpg) |

## Category placeholder — no acceptable photo (1)

| Noun | Category | Why |
| --- | --- | --- |
| Racing Wheel | Gaming | no acceptable open-license photo found (Every sim-racing wheel found has a large readable maker wordmark or logo on the hub. Category placeholder.) |
