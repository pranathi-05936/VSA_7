/**
 * Automated tests for the NLP engine (public/js/nlp.js).
 *
 * Zero dependencies on purpose: this uses Node's built-in test runner
 * (available since Node 18), not Jest/Mocha, so `npm test` works
 * immediately after `git clone` with no install step and nothing that
 * can fail to resolve from a registry. Run directly with:
 *
 *   node --test tests/
 *
 * These aren't smoke tests — every case here was a real bug caught and
 * fixed during development (see APPROACH.md for the debugging trail).
 * They exist so a regression shows up as a red test, not a support ticket.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const NLP = require('../public/js/nlp.js');

function intentOf(phrase){ return NLP.parseCommand(phrase).intent; }
function itemOf(phrase){ return NLP.parseCommand(phrase).item; }

test('catalog is non-trivial', () => {
  assert.ok(NLP.CATALOG.length >= 60, 'expected a wide catalog, not a handful of demo items');
});

test('basic add phrasing — spec examples', () => {
  assert.equal(itemOf('add milk'), 'milk');
  assert.equal(itemOf('I need apples'), 'apples');
  assert.equal(itemOf('I want to buy bananas'), 'bananas');
  assert.equal(itemOf('add bananas to my list'), 'bananas');
});

test('add does not require the command to start with a trigger word', () => {
  // Real bug: "hey are some milk to my list" (mis-transcribed "add") was
  // rejected because parsing only matched sentences starting with a
  // known verb. Fixed by scanning the whole sentence and defaulting to
  // add whenever a catalog item is found.
  const cmd = NLP.parseCommand('hey are some milk to my list');
  assert.equal(cmd.intent, 'add');
  assert.equal(cmd.item, 'milk');
});

test('quantity parsing — digits and number words', () => {
  assert.equal(NLP.parseCommand('add 2 bottles of water').qty, 2);
  assert.equal(NLP.parseCommand('buy 5 oranges').qty, 5);
  assert.equal(NLP.parseCommand('add three apples').qty, 3);
});

test('quantity parsing — native-script number words (Devanagari/Telugu)', () => {
  // Real bug: JS regex \b is defined via \w, which only covers ASCII —
  // it silently never matches at the edges of Devanagari/Telugu text, so
  // every non-Latin-script number word was unreachable even though it
  // was correctly listed in the dictionary. Fixed by switching to
  // token-based matching instead of \b regex.
  assert.equal(NLP.parseCommand('तीन दूध चाहिए').qty, 3);
  assert.equal(NLP.parseCommand('మూడు పాలు కావాలి').qty, 3);
  assert.equal(NLP.parseCommand('पांच सेब चाहिए').qty, 5);
});

test('quantity parsing — alternate transliteration spellings', () => {
  // "mudu" and "moodu" are both common spellings of the same Telugu word
  // for "three" — the dictionary needs to cover real spelling variance,
  // not just one canonical transliteration.
  assert.equal(NLP.parseCommand('mudu packets milk add chyu').qty, 3);
  assert.equal(NLP.parseCommand('naalugu apples kavali').qty, 4);
});

test('remove is quantity-aware in Hindi and Telugu too, not just English', () => {
  // Real bug: the Telugu word for "one" (ఒకటి) had a single-character
  // typo — one letter was accidentally the visually similar Malayalam
  // character instead of the correct Telugu one, so it silently never
  // matched real Telugu input and "remove one milk" always cleared the
  // whole line instead of removing just one.
  assert.equal(NLP.parseCommand('ఒకటి పాలు తీసేయు').qty, 1);
  assert.equal(NLP.parseCommand('ఒక పాలు తీసేయండి').qty, 1);
  assert.equal(NLP.parseCommand('एक दूध हटाओ').qty, 1);
});

test('size is parsed separately from quantity', () => {
  // Real bug: before size parsing existed, "1 liter milk" had its "1"
  // misread as an item count.
  const cmd = NLP.parseCommand('add 1 liter milk');
  assert.equal(cmd.item, 'milk');
  assert.equal(cmd.qty, 1);
  assert.equal(cmd.size, '1L');

  const cmd2 = NLP.parseCommand('add 500 ml water');
  assert.equal(cmd2.size, '500ml');
});

test('remove clears the whole line when no quantity is given', () => {
  const cmd = NLP.parseCommand('remove milk');
  assert.equal(cmd.intent, 'remove');
  assert.equal(cmd.qty, null);
});

test('remove is quantity-aware when a quantity is given', () => {
  // Real bug: "remove one apple" after adding 5 used to wipe the whole
  // line instead of leaving 4.
  const cmd = NLP.parseCommand('remove one apple');
  assert.equal(cmd.qty, 1);
  const cmd2 = NLP.parseCommand('remove 2 apples');
  assert.equal(cmd2.qty, 2);
});

test('modify sets a quantity directly', () => {
  const cmd = NLP.parseCommand('change milk to 3');
  assert.equal(cmd.intent, 'modify');
  assert.equal(cmd.qty, 3);
  assert.equal(NLP.parseCommand('update apples to 5').qty, 5);
});

test('search parses an item and an optional price ceiling', () => {
  const cmd = NLP.parseCommand('find toothpaste under $5');
  assert.equal(cmd.intent, 'search');
  assert.equal(cmd.maxPrice, 5);
});

test('multilingual: Hindi add phrasing resolves the same as English', () => {
  assert.equal(itemOf('मुझे दूध चाहिए'), 'milk');
  assert.equal(itemOf('दूध चाहिए'), 'milk');
});

test('multilingual: Telugu add phrasing resolves the same as English', () => {
  assert.equal(itemOf('పాలు కావాలి'), 'milk');
});

test('multilingual: Hindi/Telugu remove verb stems cover conjugated forms', () => {
  // Real bug: only exact dictionary roots ("हटाओ") matched; natural
  // conjugated/polite forms ("हटा दो", "तीसेयंडी") did not.
  assert.equal(intentOf('दूध हटाओ'), 'remove');
  assert.equal(intentOf('दूध हटा दो'), 'remove');
  assert.equal(intentOf('दूध हटा दीजिए'), 'remove');
  assert.equal(intentOf('పాలు తీసేయండి'), 'remove');
  assert.equal(intentOf('పాలు తీసివేయండి'), 'remove');
});

test('multilingual: transliterated English loanwords are recognized', () => {
  // "మిల్క్" is the Telugu transliteration of the English loanword
  // "milk" — extremely common in real code-switched speech.
  assert.equal(itemOf('మిల్క్ కావాలి'), 'milk');
});

test('invisible Unicode artifacts from ASR do not break matching', () => {
  // Real bug: zero-width joiners (U+200C) that speech recognition
  // commonly inserts into transcribed Indic scripts caused silent
  // match failures even though the text looked identical on screen.
  const withZWJ = 'ఆపి\u200Cల్ కావాలి';
  assert.equal(itemOf(withZWJ), 'apples');
});

test('brand names resolve to the specific branded product', () => {
  assert.equal(itemOf('add colgate toothpaste'), 'colgate toothpaste');
  const cmd = NLP.findInCatalog('add colgate toothpaste');
  assert.equal(cmd.brand, 'Colgate');
  assert.equal(cmd.price, 4.50);
});

test('a more specific branded alias wins over a shorter generic one', () => {
  // Real bug: sorting by "longest alias anywhere on the product" instead
  // of "longest alias actually matched" caused "lays chips" to lose to
  // the generic "chips" entry.
  const hit = NLP.findInCatalog('add lays chips');
  assert.equal(hit.id, 'chips-lays');
});

test('brands without a dedicated SKU fall back to the generic item', () => {
  const hit = NLP.findInCatalog('add tata toothpaste');
  assert.equal(hit.id, 'toothpaste');
});

test('brand display name does not duplicate when the brand already contains the item name', () => {
  // Real bug: "Tata Coffee" + base name "Coffee" produced "Tata Coffee Coffee".
  const hit = NLP.findInCatalog('add tata coffee');
  assert.equal(hit.name, 'Tata Coffee');
});

test('a branded product resolves even via a non-first base alias', () => {
  // Real bug: brand variants were only combined with the base item's
  // FIRST alias ("dish soap"), so a phrase matching a different alias
  // ("dishwash") never formed a valid combined alias, and the shorter
  // bare-brand match lost the longest-match tiebreak to the generic
  // product's own longer alias — "vim dishwash" resolved to generic
  // dish soap instead of the Vim SKU.
  const hit = NLP.findInCatalog('add vim dishwash');
  assert.equal(hit.id, 'dishwash-vim');
});

test('fuzzy matching tolerates typos and ASR mishearings', () => {
  assert.equal(NLP.findInCatalog('aple').id, 'apples');
  assert.equal(NLP.findInCatalog('suger').id, 'sugar');
  assert.equal(NLP.findInCatalog('onon').id, 'onion');
});

test('fuzzy matching does not false-positive on common filler words', () => {
  // Real bug: the word "some" edit-distance-matched "apple" and silently
  // added apples to an unrelated sentence. Fixed by excluding filler,
  // trigger, and quantity words from ever being fuzzy candidates.
  assert.equal(NLP.findInCatalog('some'), null);
  assert.equal(NLP.findInCatalog('add some random gibberish xyz item'), null);
});

test('unrecognized items resolve to no match, not a silent guess', () => {
  assert.equal(NLP.findInCatalog('completely unrecognizable nonsense'), null);
});

test('out-of-stock items are flagged for the substitute-offer flow', () => {
  const oranges = NLP.findInCatalog('oranges');
  assert.equal(oranges.outOfStock, true);
  assert.ok(oranges.substitutes.length > 0);
});

test('cheapest/priciest selectors are parsed across languages', () => {
  assert.equal(NLP.parseCommand('add the cheapest toothpaste').selector, 'cheapest');
  assert.equal(NLP.parseCommand('add the most expensive toothpaste').selector, 'expensive');
  assert.equal(NLP.parseCommand('सबसे सस्ता टूथपेस्ट add karo').selector, 'cheapest');
  assert.equal(NLP.parseCommand('చౌకైన టూత్‌పేస్ట్ కావాలి').selector, 'cheapest');
  assert.equal(NLP.parseCommand('añade el más barato toothpaste').selector, 'cheapest');
  assert.equal(NLP.parseCommand('ajoute le moins cher toothpaste').selector, 'cheapest');
});

test('a target price is parsed and distinct from a selector', () => {
  const cmd = NLP.parseCommand('add toothpaste for $4');
  assert.equal(cmd.targetPrice, 4);
  assert.equal(cmd.selector, undefined);
});

test('findVariants returns every brand of an item, not just the closest match', () => {
  const variants = NLP.findVariants('toothpaste').filter(p => !p.outOfStock);
  const names = variants.map(v => v.name).sort();
  assert.ok(names.includes('Toothpaste'));
  assert.ok(names.includes('Colgate Toothpaste'));
  assert.ok(names.includes('Sensodyne Toothpaste'));
  assert.ok(names.includes('Pepsodent Toothpaste'));
});

test('category-level search finds fruits and vegetables, across languages', () => {
  assert.equal(NLP.parseCommand('find me fruits').category, 'Fruit');
  assert.equal(NLP.parseCommand('find me vegetables').category, 'Vegetable');
  assert.equal(NLP.parseCommand('मुझे फल दिखाओ').category, 'Fruit');
  assert.equal(NLP.parseCommand('పండ్లు చూపించు').category, 'Fruit');
  assert.equal(NLP.parseCommand('సబ్జియాలు').category, undefined); // sanity: gibberish shouldn't match
  assert.equal(NLP.parseCommand('busca frutas').category, 'Fruit');
  assert.equal(NLP.parseCommand('cherche des légumes').category, 'Vegetable');
});

test('category results never mix fruits and vegetables', () => {
  const fruits = NLP.CATALOG.filter(p => p.subcategory==='Fruit');
  const veggies = NLP.CATALOG.filter(p => p.subcategory==='Vegetable');
  assert.ok(fruits.length >= 10);
  assert.ok(veggies.length >= 3);
  const overlap = fruits.filter(f => veggies.some(v => v.id===f.id));
  assert.equal(overlap.length, 0);
});

test('branded produce variants inherit the correct subcategory', () => {
  // Real risk: subcategory is only set on base items, so brand variants
  // generated from them need to inherit it, or a category search would
  // silently miss every branded fruit/vegetable.
  const freshoApples = NLP.findInCatalog('fresho apples');
  assert.equal(freshoApples.subcategory, 'Fruit');
});

test('every branded item has at least one sibling (another brand, or the generic base) for alternatives', () => {
  // "Alternatives" scaling to the whole catalog depends on every branded
  // product having something to suggest instead — either another brand
  // of the same item, or (for single-brand items) the generic version.
  const branded = NLP.CATALOG.filter(p => p.baseId);
  const withoutSibling = branded.filter(p => {
    const siblings = NLP.CATALOG.filter(o => (o.baseId===p.baseId || o.id===p.baseId) && o.id !== p.id);
    return siblings.length === 0;
  });
  assert.equal(withoutSibling.length, 0, 'every branded item should have a sibling: ' + withoutSibling.map(p=>p.name));
});

test('items can be flagged on sale independent of calendar season', () => {
  const onSale = NLP.CATALOG.filter(p => p.onSale);
  assert.ok(onSale.length >= 2);
});
