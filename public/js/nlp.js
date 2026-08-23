/**
 * Voice Shopping Assistant — NLP engine.
 *
 * Pulled out of the page into its own module for two reasons:
 *  1. It's the part of this project that actually does something
 *     interesting — catalog matching, multilingual trigger detection,
 *     fuzzy typo tolerance, size/quantity extraction — and it deserves
 *     to be testable on its own, not buried in a <script> tag.
 *  2. It lets tests/nlp.test.js exercise this exact code (not a copy)
 *     from Node, with zero build step, via the UMD export at the bottom.
 *
 * Everything in here is pure logic: no DOM access, no speech APIs, no
 * rendering. index.html loads this file with a plain <script> tag and
 * uses window.VoiceShoppingNLP; tests/nlp.test.js requires() it directly.
 */
(function(root, factory){
  if(typeof module === 'object' && module.exports){
    module.exports = factory();
  } else {
    root.VoiceShoppingNLP = factory();
  }
})(typeof self !== 'undefined' ? self : this, function(){
  "use strict";

  /* ===================== Data ===================== */

  /* Aliases include English plus common Hindi, Telugu, Spanish, and French terms
     (transliterated and native script) so a catalog match works regardless of
     which language the command was spoken in. */
  var CATALOG = [
    {id:'milk', name:'Milk', category:'Dairy', price:3.50, aliases:['milk','doodh','दूध','मिल्क','paalu','పాలు','మిల్క్','leche','lait'], substitutes:['almond-milk','oat-milk']},
    {id:'almond-milk', name:'Almond milk', category:'Dairy', price:4.20, aliases:['almond milk','बादाम का दूध','बादाम दूध','బాదం పాలు','leche de almendras','lait d\'amande']},
    {id:'oat-milk', name:'Oat milk', category:'Dairy', price:4.50, aliases:['oat milk','ओट्स का दूध','ఓట్స్ పాలు','leche de avena','lait d\'avoine']},
    {id:'butter', name:'Butter', category:'Dairy', price:4.00, aliases:['butter','makhan','मक्खन','venna','వెన్న','mantequilla','beurre']},
    {id:'cheese', name:'Cheese', category:'Dairy', price:5.50, aliases:['cheese','paneer','पनीर','queso','fromage']},
    {id:'eggs', name:'Eggs', category:'Dairy', price:3.00, aliases:['eggs','egg','ande','अंडे','guddu','గుడ్డు','huevos','oeufs','œufs']},
    {id:'bread', name:'Bread', category:'Bakery', price:2.80, aliases:['bread','ब्रेड','బ్రెడ్','pan','pain']},
    {id:'bagels', name:'Bagels', category:'Bakery', price:3.20, aliases:['bagels','bagel']},
    {id:'apples', name:'Apples', category:'Produce', subcategory:'Fruit', price:0.60, season:['fall','winter'], aliases:['apples','apple','seb','सेब','apple','ఆపిల్','manzanas','manzana','pommes','pomme'], substitutes:['pears']},
    {id:'organic-apples', name:'Organic apples', category:'Produce', subcategory:'Fruit', price:1.10, aliases:['organic apples']},
    {id:'pears', name:'Pears', category:'Produce', subcategory:'Fruit', price:0.80, aliases:['pears','pear','nashpati','नाशपाती','pera','poire']},
    {id:'bananas', name:'Bananas', category:'Produce', subcategory:'Fruit', price:0.30, aliases:['bananas','banana','kele','केले','arati pandu','అరటిపండు','plátanos','platanos','bananes']},
    {id:'strawberries', name:'Strawberries', category:'Produce', subcategory:'Fruit', price:3.50, season:['spring','summer'], aliases:['strawberries','strawberry','स्ट्रॉबेरी','స్ట్రాబెర్రీ','fresa','fraise']},
    {id:'oranges', name:'Oranges', category:'Produce', subcategory:'Fruit', price:0.70, season:['winter'], aliases:['oranges','orange','आरेंज','संतरा','ఆరెంజ్','నారింజ','naranja'], outOfStock:true, substitutes:['organic-apples','bananas']},
    {id:'mango', name:'Mango', category:'Produce', subcategory:'Fruit', price:1.20, season:['summer'], aliases:['mango','mangoes','aam','आम','mamidi','మామిడి','mango']},
    {id:'grapes', name:'Grapes', category:'Produce', subcategory:'Fruit', price:2.20, season:['summer','fall'], aliases:['grapes','grape','angoor','अंगूर','draksha','ద్రాక్ష','uvas','raisin']},
    {id:'guava', name:'Guava', category:'Produce', subcategory:'Fruit', price:0.90, onSale:true, aliases:['guava','amrud','अमरूद','jama','జామ','guayaba','goyave']},
    {id:'watermelon', name:'Watermelon', category:'Produce', subcategory:'Fruit', price:1.50, season:['summer'], aliases:['watermelon','tarbooj','तरबूज','puccakaya','పుచ్చకాయ','sandía','sandia','pastèque']},
    {id:'onion', name:'Onion', category:'Produce', subcategory:'Vegetable', price:0.50, aliases:['onion','onions','pyaz','प्याज','ullipaya','ఉల్లిపాయ','cebolla','oignon']},
    {id:'tomato', name:'Tomato', category:'Produce', subcategory:'Vegetable', price:0.55, aliases:['tomato','tomatoes','tamatar','टमाटर','tomato','టమాటా','tomate']},
    {id:'potato', name:'Potato', category:'Produce', subcategory:'Vegetable', price:0.45, aliases:['potato','potatoes','aloo','आलू','bangaladumpa','బంగాళదుంప','patata','papa','pomme de terre']},
    {id:'toothpaste', name:'Toothpaste', category:'Personal care', price:3.99, brand:'Store brand', aliases:['toothpaste','टूथपेस्ट','టూత్‌పేస్ట్','pasta de dientes','dentifrice']},
    {id:'paper-towels', name:'Paper towels', category:'Household', price:6.50, aliases:['paper towels','papel toalla','essuie-tout']},
    {id:'water', name:'Water', category:'Beverages', price:1.00, aliases:['water','bottled water','paani','पानी','neellu','నీళ్ళు','agua','eau']},
    {id:'coffee', name:'Coffee', category:'Beverages', price:8.00, brand:'Store brand', aliases:['coffee','कॉफ़ी','కాఫీ','café','cafe']},
    {id:'tea', name:'Tea', category:'Beverages', price:2.20, brand:'Store brand', aliases:['tea','chai','चाय','టీ','té','the','thé']},
    {id:'chips', name:'Chips', category:'Snacks', price:2.50, brand:'Store brand', aliases:['chips','papas fritas']},
    {id:'biscuits', name:'Biscuits', category:'Snacks', price:1.20, brand:'Store brand', aliases:['biscuits','biscuit','बिस्कुट','బిస్కెట్','galletas']},
    {id:'noodles', name:'Noodles', category:'Pantry', price:1.10, brand:'Store brand', aliases:['noodles','नूडल्स','నూడుల్స్','fideos','nouilles']},
    {id:'pasta', name:'Pasta', category:'Pantry', price:1.80, aliases:['pasta']},
    {id:'rice', name:'Rice', category:'Pantry', price:2.20, brand:'Store brand', aliases:['rice','chawal','चावल','biyyam','బియ్యం','arroz','riz']},
    {id:'sugar', name:'Sugar', category:'Pantry', price:1.60, brand:'Store brand', aliases:['sugar','cheeni','चीनी','panchadara','పంచదార','azúcar','azucar','sucre']},
    {id:'salt', name:'Salt', category:'Pantry', price:0.80, aliases:['salt','namak','नमक','uppu','ఉప్పు','sal','sel']},
    {id:'oil', name:'Cooking oil', category:'Pantry', price:3.20, brand:'Store brand', aliases:['oil','cooking oil','tel','तेल','noone','నూనె','aceite','huile']},
    {id:'ghee', name:'Ghee', category:'Pantry', price:6.00, aliases:['ghee','घी','నెయ్యి','neyyi']},
    {id:'dal', name:'Dal', category:'Pantry', price:2.40, aliases:['dal','daal','दाल','pappu','పప్పు','lentils']},
    {id:'atta', name:'Wheat flour', category:'Pantry', price:2.60, brand:'Store brand', onSale:true, aliases:['atta','wheat flour','आटा','pindi','పిండి','harina']},
    {id:'besan', name:'Gram flour', category:'Pantry', price:2.30, aliases:['besan','gram flour','बेसन','శనగపిండి']},
    {id:'oats', name:'Oats', category:'Pantry', price:2.80, aliases:['oats','ओट्स','ఓట్స్','avena']},
    {id:'cereal', name:'Cereal', category:'Pantry', price:3.40, brand:'Store brand', aliases:['cereal','cornflakes','कॉर्नफ्लेक्स','కార్న్‌ఫ్లేక్స్','cereales']},
    {id:'honey', name:'Honey', category:'Pantry', price:4.80, aliases:['honey','shahad','शहद','తేనె','miel']},
    {id:'jam', name:'Jam', category:'Pantry', price:2.90, aliases:['jam','मुरब्बा','జామ్','mermelada','confiture']},
    {id:'ketchup', name:'Ketchup', category:'Pantry', price:2.10, aliases:['ketchup','sauce tomate']},
    {id:'curd', name:'Curd', category:'Dairy', price:1.80, aliases:['curd','yogurt','yoghurt','dahi','दही','perugu','పెరుగు','yogur']},
    {id:'buttermilk', name:'Buttermilk', category:'Dairy', price:1.20, aliases:['buttermilk','chaas','छाछ','majjiga','మజ్జిగ']},
    {id:'soap', name:'Soap', category:'Personal care', price:1.50, brand:'Store brand', aliases:['soap','sabun','साबुन','sabbu','సబ్బు','jabón','jabon','savon']},
    {id:'shampoo', name:'Shampoo', category:'Personal care', price:4.50, brand:'Store brand', aliases:['shampoo','शैम्पू','షాంపూ','champú','champu','shampooing']},
    {id:'handwash', name:'Hand wash', category:'Personal care', price:2.40, aliases:['hand wash','handwash','हैंडवॉश']},
    {id:'deodorant', name:'Deodorant', category:'Personal care', price:3.80, aliases:['deodorant','deo','डिओडोरेंट','desodorante']},
    {id:'detergent', name:'Detergent', category:'Household', price:5.50, brand:'Store brand', aliases:['detergent','washing powder','डिटर्जेंट','వాషింగ్ పౌడర్','detergente','détergent']},
    {id:'dishwash', name:'Dish soap', category:'Household', price:2.20, aliases:['dish soap','dishwash','बर्तन साबुन','గిన్నెల సబ్బు']},
    {id:'tissue', name:'Tissues', category:'Household', price:1.90, aliases:['tissues','tissue paper','टिशू','టిష్యూ','pañuelos']},
    {id:'garbage-bags', name:'Garbage bags', category:'Household', price:2.60, aliases:['garbage bags','trash bags','कूड़े के थैले']}
  ];

  /* Sizes for display in search results ("1kg", "500ml") — a real
     product attribute per the spec ("brand, size, or price range"), kept
     as a lookup table rather than bloating every catalog line. */
  var DEFAULT_SIZES = {
    milk:'1L', 'almond-milk':'1L', 'oat-milk':'1L', water:'500ml', rice:'1kg', oil:'1L',
    sugar:'1kg', atta:'5kg', toothpaste:'100g', chips:'150g', biscuits:'200g', tea:'250g',
    coffee:'200g', ghee:'500g', dal:'1kg', salt:'1kg', detergent:'1kg', shampoo:'200ml',
    soap:'100g', noodles:'70g', pasta:'500g', cereal:'300g', honey:'250g', jam:'200g',
    ketchup:'500g', curd:'400g', buttermilk:'500ml', besan:'500g', oats:'500g',
    handwash:'250ml', deodorant:'150ml', dishwash:'500ml', tissue:'100 sheets',
    'garbage-bags':'30 bags', 'paper-towels':'2 rolls', cheese:'200g', butter:'100g',
    eggs:'6 pcs', bread:'400g', bagels:'4 pcs', apples:'1kg', 'organic-apples':'1kg',
    pears:'1kg', bananas:'1kg', strawberries:'250g', oranges:'1kg', onion:'1kg',
    tomato:'1kg', potato:'1kg'
  };
  CATALOG.forEach(function(p){
    if(!p.defaultSize && DEFAULT_SIZES[p.id]) p.defaultSize = DEFAULT_SIZES[p.id];
  });

  /* Available size variants for display in search results ("Sizes: 500ml, 1L")
     — items not listed here just show their single defaultSize. */
  var SIZE_OPTIONS = {
    milk:['500ml','1L'], butter:['500ml','1L'], water:['500ml','1L','2L'],
    rice:['1kg','5kg'], oil:['500ml','1L'], atta:['1kg','5kg'],
    sugar:['500g','1kg'], detergent:['500g','1kg'], shampoo:['100ml','200ml'],
    tea:['100g','250g'], coffee:['50g','200g']
  };
  CATALOG.forEach(function(p){
    var key = p.baseId || p.id;
    if(!p.sizes && SIZE_OPTIONS[key]) p.sizes = SIZE_OPTIONS[key];
  });

  /* Brand catalog: rather than hand-writing a near-duplicate object for
     every brand of every product (which doesn't scale and is easy to get
     inconsistent), each entry here just names a base item + a brand +
     that brand's price. The generation loop right after builds the full
     product objects and aliases from this table, so adding a new brand
     anywhere in the catalog is a one-line addition. */
  var BRAND_VARIANTS = [
    {baseId:'toothpaste', brand:'Colgate', price:4.50},
    {baseId:'toothpaste', brand:'Sensodyne', price:6.80},
    {baseId:'toothpaste', brand:'Pepsodent', price:3.80},
    {baseId:'coffee', brand:'Nescafé', price:9.50},
    {baseId:'coffee', brand:'Bru', price:7.80},
    {baseId:'tea', brand:'Tata Tea', price:3.00},
    {baseId:'tea', brand:'Red Label', price:2.80},
    {baseId:'chips', brand:'Lays', price:3.20},
    {baseId:'chips', brand:'Pringles', price:4.90},
    {baseId:'biscuits', brand:'Britannia', price:1.60},
    {baseId:'biscuits', brand:'Parle-G', price:1.00},
    {baseId:'noodles', brand:'Maggi', price:1.30},
    {baseId:'noodles', brand:'Yippee', price:1.20},
    {baseId:'rice', brand:'India Gate', price:3.50},
    {baseId:'rice', brand:'Fortune', price:3.20},
    {baseId:'oil', brand:'Fortune', price:4.50},
    {baseId:'oil', brand:'Saffola', price:5.20},
    {baseId:'sugar', brand:'Madhur', price:1.90},
    {baseId:'atta', brand:'Aashirvaad', price:3.10},
    {baseId:'cereal', brand:'Kellogg\'s', price:4.60},
    {baseId:'soap', brand:'Dove', price:2.50},
    {baseId:'soap', brand:'Lifebuoy', price:1.80},
    {baseId:'shampoo', brand:'Head & Shoulders', price:5.80},
    {baseId:'shampoo', brand:'Sunsilk', price:4.20},
    {baseId:'detergent', brand:'Surf Excel', price:6.50},
    {baseId:'detergent', brand:'Ariel', price:6.90},
    {baseId:'organic-apples', brand:'FreshFarm', price:4.99, size:'1kg'},
    {baseId:'organic-apples', brand:'NatureFresh', price:7.49, size:'2kg'},

    /* Dairy */
    {baseId:'milk', brand:'Amul', price:3.80},
    {baseId:'milk', brand:'Mother Dairy', price:3.70},
    {baseId:'milk', brand:'Heritage', price:3.60},
    {baseId:'milk', brand:'Nandini', price:3.40},
    {baseId:'butter', brand:'Amul', price:4.40},
    {baseId:'butter', brand:'Britannia', price:4.60},

    /* Produce */
    {baseId:'apples', brand:'Fresho', price:0.85},
    {baseId:'apples', brand:'Nature Fresh', price:0.90},
    {baseId:'bananas', brand:'Fresho', price:0.45},

    /* Bakery */
    {baseId:'bread', brand:'Britannia', price:3.20},
    {baseId:'bread', brand:'Modern', price:2.90},
    {baseId:'bread', brand:'Harvest Gold', price:3.50},

    /* Pantry */
    {baseId:'rice', brand:'Daawat', price:3.80},
    {baseId:'atta', brand:'Tata Sampann', price:3.40},
    {baseId:'dal', brand:'Tata Sampann', price:2.90},

    /* Snacks */
    {baseId:'chips', brand:'Bingo', price:3.00},
    {baseId:'biscuits', brand:'Sunfeast', price:1.70},

    /* Beverages */
    {baseId:'coffee', brand:'Tata Coffee', price:8.50},
    {baseId:'tea', brand:'Wagh Bakri', price:3.10},
    {baseId:'water', brand:'Bisleri', price:1.20},
    {baseId:'water', brand:'Aquafina', price:1.30},

    /* Personal care */
    {baseId:'soap', brand:'Pears', price:2.80},
    {baseId:'soap', brand:'Nivea', price:3.10},
    {baseId:'deodorant', brand:'Fogg', price:4.20},
    {baseId:'deodorant', brand:'Nivea', price:3.90},

    /* Household */
    {baseId:'detergent', brand:'Tide', price:6.20},
    {baseId:'dishwash', brand:'Vim', price:2.10},
    {baseId:'dishwash', brand:'Pril', price:2.40},
    {baseId:'paper-towels', brand:'Origami', price:7.20}
  ];

  BRAND_VARIANTS.forEach(function(bv){
    var base = null;
    for(var i=0;i<CATALOG.length;i++){ if(CATALOG[i].id===bv.baseId){ base=CATALOG[i]; break; } }
    if(!base) return;
    var brandLower = bv.brand.toLowerCase();
    /* Avoids "Tata Coffee Coffee" — if the brand name already contains
       the generic item name (as "Tata Coffee" contains "Coffee"), the
       brand name alone is the display name. */
    var displayName = brandLower.indexOf(base.name.toLowerCase())!==-1 ? bv.brand : (bv.brand + ' ' + base.name);
    /* Combine the brand with EVERY base alias, not just the first —
       otherwise a phrasing that matches the base item's second alias
       ("dishwash") but not its first ("dish soap") never forms a valid
       combined alias, and the shorter bare-brand alias loses the
       longest-match tiebreak to the generic product's own longer alias. */
    var aliases = [brandLower];
    base.aliases.forEach(function(a){ aliases.push(brandLower + ' ' + a); });
    CATALOG.push({
      id: bv.baseId + '-' + brandLower.replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),
      name: displayName,
      category: base.category,
      subcategory: base.subcategory,
      price: bv.price,
      sizes: base.sizes,
      brand: bv.brand,
      baseId: bv.baseId,
      defaultSize: bv.size || base.defaultSize,
      aliases: aliases
    });
  });

  function resolveBaseId(id){
    var p = findById(id);
    return (p && p.baseId) ? p.baseId : id;
  }

  /* Items commonly bought together — drives suggestions that actually
     react to what's in the cart right now, rather than only a fixed
     simulated-history list. Keyed by base item id so it works the same
     whether the cart has the generic product or any branded variant
     (e.g. "Nescafé Coffee" still triggers the coffee -> sugar pairing). */
  var COMPLEMENTS = {
    milk: ['cereal','oats'],
    bread: ['butter','jam','honey'],
    pasta: ['ketchup','cheese'],
    rice: ['dal','ghee'],
    tea: ['sugar'],
    coffee: ['sugar','milk'],
    eggs: ['bread','butter'],
    atta: ['oil','ghee'],
    chips: ['ketchup'],
    noodles: ['ketchup'],
    biscuits: ['tea','coffee'],
    curd: ['rice'],
    onion: ['tomato'],
    tomato: ['onion'],
    potato: ['onion'],
    toothpaste: ['soap'],
    cereal: ['milk']
  };

  /* Simulated purchase history, used to power "running low" suggestions. */
  var HISTORY = [
    {id:'bread', intervalDays:7, daysSinceLast:8},
    {id:'milk', intervalDays:7, daysSinceLast:2},
    {id:'coffee', intervalDays:14, daysSinceLast:19},
    {id:'paper-towels', intervalDays:21, daysSinceLast:25},
    {id:'eggs', intervalDays:10, daysSinceLast:12},
    {id:'rice', intervalDays:30, daysSinceLast:34},
    {id:'sugar', intervalDays:21, daysSinceLast:23},
    {id:'onion', intervalDays:10, daysSinceLast:15},
    {id:'toothpaste', intervalDays:45, daysSinceLast:50},
    {id:'tea', intervalDays:14, daysSinceLast:16}
  ];

  /* Fallback tier so the rail never sits empty just because the simulated
     history/season pool ran out — a few sensible staples to reach for. */
  var POPULAR_FALLBACK = ['milk','bread','eggs','bananas','onion','tomato','rice','water'];

  var CATEGORY_ORDER = ['Dairy','Produce','Bakery','Pantry','Snacks','Beverages','Personal care','Household','Other'];

  function currentSeason(){
    var m = new Date().getMonth(); // 0-11
    if(m>=2 && m<=4) return 'spring';
    if(m>=5 && m<=7) return 'summer';
    if(m>=8 && m<=10) return 'fall';
    return 'winter';
  }

  function findById(id){
    for(var i=0;i<CATALOG.length;i++){ if(CATALOG[i].id===id) return CATALOG[i]; }
    return null;
  }

  /* Small edit-distance calculator, used only as a last-resort fallback
     when no exact/substring alias match exists — catches ASR mishearings,
     typos, and inflected forms we didn't think to list explicitly. */
  function levenshtein(a, b){
    if(a===b) return 0;
    if(a.length===0) return b.length;
    if(b.length===0) return a.length;
    var prev = [];
    for(var j=0;j<=b.length;j++) prev[j]=j;
    for(var i=1;i<=a.length;i++){
      var cur=[i];
      for(var j=1;j<=b.length;j++){
        cur[j] = a[i-1]===b[j-1] ? prev[j-1] : 1+Math.min(prev[j-1],prev[j],cur[j-1]);
      }
      prev = cur;
    }
    return prev[b.length];
  }

  /* Word-boundary-safe containment check. Plain indexOf() would let a
     short alias like "tel" (Hindi for oil) match inside the middle of
     an unrelated word like "completely" — this only counts a match
     when the alias lines up with actual token boundaries in the
     (already space-normalized) text, in either direction. */
  function wordBoundaryContains(haystack, needle){
    if(needle.indexOf(' ')===-1){
      return haystack.split(' ').indexOf(needle)!==-1;
    }
    return (' '+haystack+' ').indexOf(' '+needle+' ')!==-1;
  }

  /* Fuzzy-ish alias match: exact alias, then substring, then edit-distance
     on individual words, then no match. Both sides run through
     normalizeText so invisible ASR artifacts (zero-width joiners etc,
     common in transcribed Indic scripts) never cause a real match to be
     missed. */
  function findInCatalog(phrase){
    var q = normalizeText(phrase.trim().toLowerCase());
    if(!q) return null;
    var exact = CATALOG.filter(function(p){
      return p.aliases.some(function(a){ return normalizeText(a)===q; });
    });
    if(exact.length) return exact[0];
    var partial = [];
    CATALOG.forEach(function(p){
      var matchLen = 0;
      p.aliases.forEach(function(a){
        var na = normalizeText(a);
        if(na.length>0 && (wordBoundaryContains(q, na) || wordBoundaryContains(na, q))){
          if(na.length>matchLen) matchLen = na.length;
        }
      });
      if(matchLen>0) partial.push({product:p, matchLen:matchLen});
    });
    /* Prefer the longest matched alias — this is what lets "lays chips"
       resolve to the Lays SKU instead of the generic "chips" entry, since
       the matched alias itself ("lays chips") is longer and more specific
       than "chips" even though the generic product also matches. */
    partial.sort(function(a,b){ return b.matchLen - a.matchLen; });
    if(partial.length) return partial[0].product;

    /* Fuzzy fallback: compare each word in the utterance against each
       catalog alias by edit distance. Tolerance scales with word length
       so short words stay strict (avoids "tea" matching everything)
       while longer words tolerate a couple of ASR/typo slips.
       Filler/function words and known trigger words are excluded first —
       otherwise a common word like "some" can end up an accidental
       near-match for a short product name like "apple". */
    var stop = getStopwords();
    var words = q.split(' ').filter(function(w){ return w.length>=3 && !stop[w]; });
    var best = null, bestDist = Infinity;
    words.forEach(function(w){
      CATALOG.forEach(function(p){
        p.aliases.forEach(function(a){
          var na = normalizeText(a);
          if(na.length<3) return;
          var tolerance = na.length<=4 ? 1 : (na.length<=7 ? 2 : 3);
          var d = levenshtein(w, na);
          if(d<=tolerance && d<bestDist){ bestDist=d; best=p; }
        });
      });
    });
    return best;
  }

  var STOPWORDS_CACHE = null;
  function getStopwords(){
    if(STOPWORDS_CACHE) return STOPWORDS_CACHE;
    var words = ['some','any','a','an','the','item','items','thing','things','stuff','something','anything',
                 'for','to','and','with','in','on','at','is','are','was','were','of','my','list','please',
                 'can','you','could','would','should','me','i','we','it','this','that','there','please',
                 'kuch','कुछ','chij','चीज़','koddi','కొంత','edo','ఏదో','algo','quelque','quelquechose'];
    [].concat(TRIGGERS.add, TRIGGERS.remove, TRIGGERS.search, TRIGGERS.modify).forEach(function(phrase){
      phrase.split(' ').forEach(function(w){ if(w) words.push(w); });
    });
    Object.keys(QTY_WORDS).forEach(function(w){ words.push(w); });
    var set = {};
    words.forEach(function(w){ set[w.toLowerCase()] = true; });
    STOPWORDS_CACHE = set;
    return set;
  }

  /* ===================== NLP command parsing ===================== */

  /* Order-independent keyword scan: rather than anchoring a regex to the
     start of the sentence (which breaks on "hey, add milk" or on
     verb-final languages like Hindi/Telugu — "doodh chahiye" = "milk
     is needed"), we scan the whole utterance for trigger phrases in any
     position, in any of these languages, and separately scan for a
     catalog item anywhere in the sentence. Order never matters. */
  var TRIGGERS = {
    remove: ['remove','delete','take off','get rid of','cross off',"don't need",'dont need','no longer need',
             /* Hindi: हटा/hata covers हटाओ, हटा दो, हटा दीजिए, हटाइए, हटा दीजिये;
                निकाल/nikaal covers निकालो, निकाल दो, निकालिए, निकाल दीजिए */
             'hata','हटा','nikaal','निकाल',
             /* Telugu: తీసే/teese covers తీసేయు, తీసేయండి, తీసేయాలి;
                తీసివే/teesive covers తీసివేయు, తీసివేయండి */
             'teese','తీసే','teesive','తీసివే','vaddu','వద్దు',
             'quita','elimina','borra','no necesito',
             "enlève",'enleve','supprime','retire'],
    search: ['find','search','look for','show me','where can i','suggest','recommend','suggest me','recommend me',
             'dhoondo','ढूंढो','khojo','खोजो','sujhao','सुझाओ','सुझाइए','batao','बताओ','dikhao','दिखाओ','दिखाइए',
             'vethuku','వెతుకు','వెతకు','cheppu','చెప్పు','సూచించు','choopinchu','చూపించు',
             'busca','encuentra','sugiere','recomienda',
             'cherche','trouve','suggère','recommande'],
    add:    ['add','need','want to buy','i want','i need','buy','get me',"don't forget",'dont forget',
             'grab','pick up',"i'll take",'we need','put',
             'mujhe','मुझे','chahiye','चाहिए','jod','जोड़','khareed','खरीद','lena','लेना','le lo','ले लो','le aana','ले आना','laao','लाओ',
             'kavali','కావాలి','koneali','కొనాలి','teesuko','తీసుకో',
             'necesito','agrega','añade','anade','quiero comprar','compra',
             "j'ai besoin",'ajoute','achète','achete','mets'],
    modify: ['change','update','make it','set',
             'badal','बदल','kar do','कर दो',
             'marchu','మార్చు','marustunna','మార్చండి',
             'cambia','modifica',
             'change','modifie']
  };

  /* Superlative selectors — "add the cheapest toothpaste" or "add the
     most expensive coffee" should pick among ALL brand variants of that
     item, not just whichever one happens to match first. */
  var SELECTOR_TRIGGERS = {
    cheapest: ['cheapest','lowest price','least expensive','cheap one',
               'सबसे सस्ता','सस्ता वाला','सस्ता',
               'చౌకైనది','చౌకైన','చౌక','తక్కువ ధర',
               'más barato','el más barato',
               'le moins cher'],
    expensive: ['costliest','most expensive','priciest','highest price','expensive one',
                'सबसे महंगा','महंगा वाला','महंगा',
                'ఖరీదైనది','ఖరీదైన','ఎక్కువ ధర',
                'más caro','el más caro',
                'le plus cher']
  };

  /* All catalog entries matching a phrase (not just the single best
     match) — used for selector/price-target picking, and available for
     search results, so "toothpaste" surfaces the generic item plus
     every branded variant. */
  function findVariants(phrase){
    var q = normalizeText(phrase.trim().toLowerCase());
    if(!q) return [];
    return CATALOG.filter(function(p){
      return p.aliases.some(function(a){
        var na = normalizeText(a);
        return na.length>0 && (wordBoundaryContains(q, na) || wordBoundaryContains(na, q));
      });
    });
  }

  /* Brand names without a dedicated catalog SKU are treated as noise and
     stripped before matching, so "add Tata toothpaste" still resolves to
     the generic item. Brands that DO have a specific product (Colgate,
     Sensodyne, Nescafé, Lays) are matched directly instead — see
     findInCatalog's brand-aware pass in parseCommand. */
  var BRAND_NOISE = ['pepsodent','dove','lifebuoy','tata','amul','nestle',
                      'britannia','parle','maggi','pringles','coca cola','pepsi'];

  var FILLER = /\b(please|for me|to my list|from my list|on my list|my list|to the list|hey|okay|ok)\b/gi;
  var QTY_WORDS = {
    one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,a:1,an:1,couple:2,
    /* Hindi — Latin transliteration (multiple common spellings) + Devanagari */
    ek:1,do:2,teen:3,char:4,chaar:4,paanch:5,panch:5,
    '\u090f\u0915':1,'\u0926\u094b':2,'\u0924\u0940\u0928':3,'\u091a\u093e\u0930':4,'\u092a\u093e\u0902\u091a':5,'\u092a\u093e\u0902\u091a\u0947':5,
    /* Telugu — Latin transliteration (multiple common spellings) + Telugu script */
    okati:1,oka:1,rendu:2,rendhu:2,moodu:3,mudu:3,moodhu:3,nalugu:4,naalugu:4,aidu:5,aidhu:5,ayidu:5,
    '\u0c12\u0c15\u0c1f\u0c3f':1,'\u0c12\u0c15':1,'\u0c30\u0c46\u0c02\u0c21\u0c41':2,'\u0c2e\u0c42\u0c21\u0c41':3,'\u0c28\u0c3e\u0c32\u0c41\u0c17\u0c41':4,'\u0c10\u0c26\u0c41':5,
    /* Spanish / French */
    uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,
    un:1,une:1,deux:2,trois:3,quatre:4,cinq:5
  };

  var CATEGORY_QUERIES = {
    Fruit: ['fruits','fruit','फल','फलों','పండ్లు','పండు','frutas','fruta'],
    Vegetable: ['vegetables','vegetable','veggies','सब्जी','सब्जियां','सब्ज़ियां','కూరగాయలు','కూరగాయ','verduras','légumes','legumes']
  };

  function detectCategoryQuery(text){
    for(var cat in CATEGORY_QUERIES){
      if(containsAny(text, CATEGORY_QUERIES[cat])) return cat;
    }
    return null;
  }

  function containsAny(text, phrases){
    for(var i=0;i<phrases.length;i++){ if(text.indexOf(phrases[i])!==-1) return true; }
    return false;
  }

  /* Size is a distinct concept from quantity (count) — "1 liter milk" is
     one unit sized 1L, not a count of 1. Extracted and stripped from the
     text before quantity/item parsing runs, so its number is never
     mistaken for an item count. */
  var SIZE_UNIT_MAP = {
    ml:'ml','मिली':'ml','మిల్లీ':'ml','mililitros':'ml',
    l:'L', liter:'L', litre:'L', liters:'L', litres:'L','लीटर':'L','లీటర్':'L','litro':'L','litros':'L',
    kg:'kg', kilo:'kg', kilos:'kg', kilogram:'kg', kilograms:'kg','किलो':'kg','కిలో':'kg',
    g:'g', gram:'g', grams:'g','ग्राम':'g','గ్రాము':'g','gramo':'g','gramos':'g',
    dozen:'dozen', dozens:'dozen'
  };
  var SIZE_UNIT_PATTERN = Object.keys(SIZE_UNIT_MAP).sort(function(a,b){return b.length-a.length;}).join('|');
  var SIZE_RE = new RegExp('(\\d+(?:\\.\\d+)?)\\s*(' + SIZE_UNIT_PATTERN + ')\\b', 'i');

  function extractSize(text){
    var m = text.match(SIZE_RE);
    if(!m) return null;
    var value = parseFloat(m[1]);
    var unit = SIZE_UNIT_MAP[m[2].toLowerCase()] || m[2];
    var displayValue = value % 1 === 0 ? value : value;
    return {value: value, unit: unit, label: displayValue + unit, matchText: m[0]};
  }

  /* Token-based, not regex \b — JavaScript's \b word-boundary is defined
     via \w, which only covers ASCII letters/digits. It silently fails to
     match at the edges of Devanagari or Telugu words entirely, which
     would make every non-Latin-script number word in QTY_WORDS
     unreachable. Splitting on the already-normalized single spaces sidesteps
     the problem for any script. */
  function extractQty(text){
    var m = text.match(/\b(\d+)\b/);
    if(m) return {qty: parseInt(m[1],10), rest: text.replace(m[0],'').trim()};
    var tokens = text.split(' ');
    for(var i=0;i<tokens.length;i++){
      if(QTY_WORDS.hasOwnProperty(tokens[i])){
        var rest = tokens.slice(0,i).concat(tokens.slice(i+1)).join(' ').trim();
        return {qty: QTY_WORDS[tokens[i]], rest: rest};
      }
    }
    return {qty:1, rest:text};
  }

  /* Returns null when no quantity word/digit is present at all, as
     opposed to extractQty which defaults to 1 — needed so "remove one
     apple" (take away 1) can be told apart from "remove milk" (take away
     all of it). */
  function tryExtractQty(text){
    var m = text.match(/\b(\d+)\b/);
    if(m) return parseInt(m[1],10);
    var tokens = text.split(' ');
    for(var i=0;i<tokens.length;i++){
      if(QTY_WORDS.hasOwnProperty(tokens[i])) return QTY_WORDS[tokens[i]];
    }
    return null;
  }

  function stripUnits(text){
    return text.replace(/\b(bottles?|cans?|bags?|boxes?|packs?|of)\b/gi,'').replace(/\s+/g,' ').trim();
  }

  function stripTriggers(text){
    var all = TRIGGERS.remove.concat(TRIGGERS.search, TRIGGERS.add, TRIGGERS.modify);
    var out = text;
    all.forEach(function(phrase){ out = out.split(phrase).join(' '); });
    return out.replace(/\s+/g,' ').trim();
  }

  function stripBrands(text){
    var out = text;
    BRAND_NOISE.forEach(function(b){ out = out.split(b).join(' '); });
    return out.replace(/\s+/g,' ').trim();
  }

  function normalizeText(text){
    return text
      .normalize('NFC')
      .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g,'') /* zero-width joiners/marks common in ASR output for Indic scripts */
      .replace(/[।॥,]/g,' ')                              /* Devanagari punctuation */
      .replace(/\s+/g,' ')
      .trim();
  }

  function parseCommand(raw){
    var text0 = normalizeText(raw.toLowerCase()).replace(FILLER,' ').replace(/[.?!]/g,'').replace(/\s+/g,' ').trim();
    if(!text0) return {intent:'unknown'};

    /* Pull size out first — otherwise "1 liter milk" would have its "1"
       mistaken for an item-count quantity rather than a size. */
    var sizeInfo = extractSize(text0);
    var text = sizeInfo ? text0.split(sizeInfo.matchText).join(' ').replace(/\s+/g,' ').trim() : text0;

    /* Try matching with any brand name still in place first — this is
       what lets "colgate toothpaste" resolve to the specific Colgate SKU
       rather than the generic one. Only fall back to stripping unlisted
       brand noise (e.g. "Tata toothpaste", no dedicated SKU) if that
       direct match comes up empty. */
    var catalogHit = findInCatalog(text) || findInCatalog(stripBrands(text));

    /* Price filter works alongside a search trigger in any language. */
    var priceMatch = text.match(/under\s*\$?\s*(\d+(?:\.\d+)?)/);

    /* Modify only fires when there's both a modify-style trigger AND a
       number present — otherwise "change" alone is too ambiguous and we'd
       rather fall through to add/remove than misfire. */
    var modifyQtyMatch = text.match(/\b(\d+)\b/);
    if(containsAny(text, TRIGGERS.modify) && modifyQtyMatch && catalogHit){
      return {intent:'modify', item: catalogHit.name.toLowerCase(), qty: parseInt(modifyQtyMatch[1],10), size: sizeInfo ? sizeInfo.label : null};
    }

    /* Category-level query ("find me fruits", "फल दिखाओ") is checked
       ahead of remove/add — unambiguous enough to win even if the
       sentence also contains an add-style word ("मुझे") that would
       otherwise be checked first. */
    var categoryHit = detectCategoryQuery(text);
    if(categoryHit && !containsAny(text, TRIGGERS.remove)){
      var catOut = {intent:'search', category: categoryHit, item: categoryHit.toLowerCase() + 's'};
      if(priceMatch) catOut.maxPrice = parseFloat(priceMatch[1]);
      return catOut;
    }

    if(containsAny(text, TRIGGERS.remove)){
      var removeQty = tryExtractQty(text);
      var removeItem = catalogHit ? catalogHit.name : stripUnits(stripTriggers(text)).replace(/\b\d+\b/g,'').trim();
      return {intent:'remove', item: removeItem.toLowerCase(), qty: removeQty, size: sizeInfo ? sizeInfo.label : null};
    }

    if(containsAny(text, TRIGGERS.search) || priceMatch){
      var searchItem = catalogHit ? catalogHit.name : stripUnits(stripTriggers(text));
      var out = {intent:'search', item: searchItem.toLowerCase()};
      if(priceMatch) out.maxPrice = parseFloat(priceMatch[1]);
      return out;
    }

    if(containsAny(text, TRIGGERS.add) || catalogHit){
      /* "add the cheapest toothpaste" / "add the most expensive coffee" —
         detected as a selector rather than resolved to a single product,
         since the actual choice depends on comparing every brand variant. */
      var selector = null;
      if(containsAny(text, SELECTOR_TRIGGERS.cheapest)) selector = 'cheapest';
      else if(containsAny(text, SELECTOR_TRIGGERS.expensive)) selector = 'expensive';

      /* "add toothpaste for $4" / "add a $4 toothpaste" — a specific
         target price, distinct from search's "under $X" (which requires
         the word "under" and is handled above). Stripped from the text
         before quantity parsing so "$4" is never misread as a count. */
      var addPriceMatch = text.match(/\$\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*dollars?\b/);
      var targetPrice = null;
      var textForQty = text;
      if(addPriceMatch){
        targetPrice = parseFloat(addPriceMatch[1] || addPriceMatch[2]);
        textForQty = text.split(addPriceMatch[0]).join(' ').replace(/\s+/g,' ').trim();
      }

      var q = extractQty(textForQty);
      var addItem = catalogHit ? catalogHit.name.toLowerCase() : stripUnits(stripTriggers(q.rest));
      var out = {intent:'add', item: addItem, qty:q.qty, size: sizeInfo ? sizeInfo.label : null};
      if(selector) out.selector = selector;
      if(targetPrice!=null) out.targetPrice = targetPrice;
      return out;
    }

    /* Short bare utterance with no recognized trigger or item, e.g. a
       one-off word — still worth attempting to add rather than rejecting
       outright (handleAdd will reject it cleanly if it's not a real item). */
    if(text.split(' ').length <= 3){
      var q2 = extractQty(text);
      return {intent:'add', item: stripUnits(q2.rest).trim(), qty:q2.qty, size: sizeInfo ? sizeInfo.label : null};
    }

    return {intent:'unknown', raw:text};
  }

  function capitalize(s){ return s.replace(/\b\w/g, function(c){return c.toUpperCase();}); }

  return {
    CATALOG: CATALOG,
    HISTORY: HISTORY,
    POPULAR_FALLBACK: POPULAR_FALLBACK,
    CATEGORY_ORDER: CATEGORY_ORDER,
    TRIGGERS: TRIGGERS,
    findById: findById,
    findInCatalog: findInCatalog,
    parseCommand: parseCommand,
    capitalize: capitalize,
    normalizeText: normalizeText,
    levenshtein: levenshtein,
    extractSize: extractSize,
    extractQty: extractQty,
    tryExtractQty: tryExtractQty,
    currentSeason: currentSeason,
    wordBoundaryContains: wordBoundaryContains,
    resolveBaseId: resolveBaseId,
    COMPLEMENTS: COMPLEMENTS,
    findVariants: findVariants,
    detectCategoryQuery: detectCategoryQuery,
    CATEGORY_QUERIES: CATEGORY_QUERIES
  };
});
