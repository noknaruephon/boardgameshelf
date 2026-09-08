// node --test api/_lib
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCollection, parseThings, cleanDescription } from './bgg.js';

const COLLECTION = `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<items totalitems="3" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse" pubdate="Mon, 08 Sep 2026 10:00:00 +0000">
  <item objecttype="thing" objectid="13" subtype="boardgame" collid="1">
    <name sortindex="1">CATAN</name>
    <yearpublished>1995</yearpublished>
    <image>https://cf.geekdo-images.com/catan.jpg</image>
    <thumbnail>https://cf.geekdo-images.com/catan_t.jpg</thumbnail>
    <stats minplayers="3" maxplayers="4" minplaytime="60" maxplaytime="120" playingtime="120" numowned="200000">
      <rating value="7">
        <usersrated value="130000"/>
        <average value="7.09"/>
        <bayesaverage value="6.9"/>
        <ranks><rank type="subtype" id="1" name="boardgame" friendlyname="Board Game Rank" value="500" bayesaverage="6.9"/></ranks>
      </rating>
    </stats>
    <status own="1" prevowned="0" fortrade="0" want="0" wanttoplay="0" wanttobuy="0" wishlist="0" preordered="0" lastmodified="2020-01-01 00:00:00"/>
    <numplays>12</numplays>
    <comment>The &amp;quot;classic&amp;quot; one</comment>
  </item>
  <item objecttype="thing" objectid="13" subtype="boardgame" collid="2">
    <name sortindex="1">CATAN</name>
    <stats minplayers="3" maxplayers="4"><rating value="N/A"><average value="7.09"/></rating></stats>
    <status own="1" wishlist="0"/>
    <numplays>0</numplays>
  </item>
  <item objecttype="thing" objectid="2" subtype="boardgame" collid="3">
    <name sortindex="1">Dragonmaster</name>
    <stats minplayers="3" maxplayers="4" playingtime="30"><rating value="N/A"><average value="6.5"/></rating></stats>
    <status own="0" prevowned="1" wishlist="1"/>
    <numplays>0</numplays>
  </item>
  <item objecttype="thing" objectid="822" subtype="boardgame" collid="4">
    <name sortindex="1">Carcassonne</name>
    <stats minplayers="2" maxplayers="5" minplaytime="30" maxplaytime="45" playingtime="45"><rating value="N/A"><average value="7.4"/></rating></stats>
    <status own="1" wishlist="1"/>
    <numplays>3</numplays>
  </item>
</items>`;

test('parseCollection: owned rows only, one per game, rating N/A → null', () => {
  const { error, items } = parseCollection(COLLECTION);
  assert.equal(error, null);
  assert.deepEqual(items.map((i) => i.bgg_id), ['13', '822']);
  const catan = items[0];
  assert.equal(catan.name, 'CATAN');
  assert.equal(catan.year_published, 1995);
  assert.equal(catan.min_players, 3);
  assert.equal(catan.max_playtime, 120);
  assert.equal(catan.bgg_rating, 7.09);
  assert.equal(catan.user_rating, 7);
  assert.equal(catan.num_plays, 12);
  assert.equal(catan.wishlist, false);
  assert.equal(catan.comment, 'The "classic" one');
  assert.equal(catan.thumbnail_url, 'https://cf.geekdo-images.com/catan_t.jpg');
  const carc = items[1];
  assert.equal(carc.user_rating, null);
  assert.equal(carc.wishlist, true);
  assert.equal(carc.max_playtime, 45);
  assert.equal(carc.year_published, null);
});

test('parseCollection: a single item still parses as a list', () => {
  const one = `<items totalitems="1"><item objecttype="thing" objectid="9" subtype="boardgame" collid="1"><name sortindex="1">Solo</name><status own="1"/><numplays>1</numplays></item></items>`;
  const { items } = parseCollection(one);
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'Solo');
  assert.equal(items[0].min_players, null);
});

test('parseCollection: empty collection is not an error', () => {
  const { error, items } = parseCollection('<items totalitems="0" termsofuse="x"></items>');
  assert.equal(error, null);
  assert.deepEqual(items, []);
});

test('parseCollection: invalid username', () => {
  const { error } = parseCollection('<errors><error><message>Invalid username specified</message></error></errors>');
  assert.equal(error.kind, 'not_found');
});

test('parseCollection: other BGG errors are reported as private/other', () => {
  const { error } = parseCollection('<errors><error><message>This collection is private</message></error></errors>');
  assert.equal(error.kind, 'private');
});

const THING = `<?xml version="1.0" encoding="utf-8"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item type="boardgame" id="13">
    <thumbnail>https://cf.geekdo-images.com/catan_t.jpg</thumbnail>
    <image>https://cf.geekdo-images.com/catan.jpg</image>
    <name type="primary" sortindex="1" value="CATAN"/>
    <name type="alternate" sortindex="1" value="Die Siedler von Catan"/>
    <description>In CATAN (formerly The Settlers of Catan), players try to be the dominant force on the island of Catan.&amp;#10;&amp;#10;Second paragraph with &amp;quot;quotes&amp;quot; &amp;amp; more.</description>
    <yearpublished value="1995"/>
    <minplayers value="3"/>
    <maxplayers value="4"/>
    <poll name="suggested_numplayers" title="User Suggested Number of Players" totalvotes="1200">
      <results numplayers="2"><result value="Best" numvotes="10"/><result value="Recommended" numvotes="100"/><result value="Not Recommended" numvotes="900"/></results>
      <results numplayers="3"><result value="Best" numvotes="300"/><result value="Recommended" numvotes="700"/><result value="Not Recommended" numvotes="50"/></results>
      <results numplayers="4"><result value="Best" numvotes="900"/><result value="Recommended" numvotes="200"/><result value="Not Recommended" numvotes="20"/></results>
      <results numplayers="4+"><result value="Best" numvotes="0"/><result value="Recommended" numvotes="10"/><result value="Not Recommended" numvotes="600"/></results>
    </poll>
    <playingtime value="120"/>
    <minplaytime value="60"/>
    <maxplaytime value="120"/>
    <minage value="10"/>
    <link type="boardgamecategory" id="1026" value="Negotiation"/>
    <link type="boardgamecategory" id="1015" value="Economic"/>
    <link type="boardgamemechanic" id="2072" value="Dice Rolling"/>
    <link type="boardgamemechanic" id="2008" value="Trading"/>
    <link type="boardgamedesigner" id="11" value="Klaus Teuber"/>
    <statistics page="1">
      <ratings>
        <usersrated value="130000"/>
        <average value="7.09"/>
        <bayesaverage value="6.9"/>
        <ranks><rank type="subtype" id="1" name="boardgame" friendlyname="Board Game Rank" value="500" bayesaverage="6.9"/></ranks>
        <averageweight value="2.31"/>
      </ratings>
    </statistics>
  </item>
  <item type="boardgameexpansion" id="926">
    <name type="primary" sortindex="1" value="CATAN: Seafarers"/>
    <description>Sea.</description>
    <yearpublished value="1997"/>
    <minplayers value="3"/><maxplayers value="4"/>
    <playingtime value="90"/>
    <poll name="suggested_numplayers" totalvotes="0"></poll>
    <statistics page="1"><ratings><average value="7.2"/><averageweight value="2.4"/></ratings></statistics>
  </item>
  <item type="boardgameperson" id="11"><name type="primary" value="Klaus Teuber"/></item>
</items>`;

test('parseThings: full record incl. taxonomy, weight and poll', () => {
  const rows = parseThings(THING);
  assert.deepEqual(rows.map((r) => r.bgg_id), ['13', '926']);
  const catan = rows[0];
  assert.equal(catan.name, 'CATAN');
  assert.equal(catan.subtype, 'boardgame');
  assert.equal(catan.year_published, 1995);
  assert.equal(catan.min_playtime, 60);
  assert.equal(catan.max_playtime, 120);
  assert.equal(catan.weight, 2.31);
  assert.equal(catan.bgg_rating, 7.09);
  assert.deepEqual(catan.mechanics, ['Dice Rolling', 'Trading']);
  assert.deepEqual(catan.categories, ['Negotiation', 'Economic']);
  assert.deepEqual(catan.player_recommendations, { 2: 'not', 3: 'recommended', 4: 'best' });
  assert.equal(catan.description, 'In CATAN (formerly The Settlers of Catan), players try to be the dominant force on the island of Catan.\n\nSecond paragraph with "quotes" & more.');
  const exp = rows[1];
  assert.equal(exp.subtype, 'boardgameexpansion');
  assert.equal(exp.min_playtime, 90);
  assert.equal(exp.max_playtime, 90);
  assert.equal(exp.player_recommendations, null);
  assert.deepEqual(exp.mechanics, []);
});

test('parseThings: an empty response yields no rows', () => {
  assert.deepEqual(parseThings('<items termsofuse="x"></items>'), []);
});

test('cleanDescription strips tags and collapses blank lines', () => {
  assert.equal(cleanDescription('A&#10;&#10;&#10;<b>B</b>&nbsp;C'), 'A\n\nB C');
});

// ---- user + brief collection (the /api/bgg/lookup endpoint) ----
import { parseUser, countCollectionItems } from './bgg.js';

test('parseUser: canonical name and id when the account exists', () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?><user id="123456" name="NokNaruephon" termsofuse="x"><firstname value=""/><lastname value=""/><avatarlink value="N/A"/><yearregistered value="2019"/></user>`;
  assert.deepEqual(parseUser(xml), { id: '123456', name: 'NokNaruephon' });
});

test('parseUser: unknown account has an empty id', () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?><user id="" name="nobody-here" termsofuse="x"><firstname value=""/></user>`;
  assert.equal(parseUser(xml), null);
  assert.equal(parseUser('<errors><error><message>Not found</message></error></errors>'), null);
});

test('countCollectionItems: totalitems wins, item count is the fallback', () => {
  assert.equal(countCollectionItems('<items totalitems="196" termsofuse="x"></items>'), 196);
  assert.equal(countCollectionItems('<items termsofuse="x"><item objectid="1"/><item objectid="2"/></items>'), 2);
  assert.equal(countCollectionItems('<items totalitems="0"></items>'), 0);
  assert.equal(countCollectionItems('<errors><error><message>Invalid username specified</message></error></errors>'), null);
});
