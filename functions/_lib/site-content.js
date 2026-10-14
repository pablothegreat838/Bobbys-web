export const SITE_TEXT_FIELDS = [
  { key: 'links.eyebrow', page: 'Links', label: 'Page label', value: 'The link collection' },
  { key: 'links.title', page: 'Links', label: 'Heading', value: 'Links.' },
  { key: 'links.intro', page: 'Links', label: 'Introduction', value: 'Browse by category or search by entry number, name, or link.' },
  { key: 'links.search', page: 'Links', label: 'Search placeholder', value: 'Search number, name, or URL...' },
  { key: 'links.emptyTitle', page: 'Links', label: 'Empty-list heading', value: 'No links published yet' },
  { key: 'links.emptyMessage', page: 'Links', label: 'Empty-list message', value: 'Check back later for new links.' },
  { key: 'movies.eyebrow', page: 'Movies', label: 'Page label', value: 'The movie collection' },
  { key: 'movies.title', page: 'Movies', label: 'Heading', value: 'Movies.' },
  { key: 'movies.search', page: 'Movies', label: 'Search placeholder', value: 'Search movies...' },
  { key: 'movies.emptyTitle', page: 'Movies', label: 'Empty-list heading', value: 'No movies added yet' },
  { key: 'movies.emptyMessage', page: 'Movies', label: 'Empty-list message', value: 'New movies will appear here.' },
  { key: 'terms.eyebrow', page: 'Terms', label: 'Page label', value: "Bobbys Terms & Services" },
  { key: 'terms.title', page: 'Terms', label: 'Heading', value: 'Terms & Services.' },
  { key: 'terms.intro', page: 'Terms', label: 'Introduction', value: 'By using this site, you agree to these terms. Please also follow the rules set by any other sites, games, schools, or services you visit.' },
  { key: 'terms.thirdPartyTitle', page: 'Terms', label: 'Third-party links title', value: 'Third-party links.' },
  { key: 'terms.thirdPartyBody', page: 'Terms', label: 'Third-party links text', value: 'Links are provided as-is and may lead to sites that Bobby does not own or control. Check that a site is trustworthy before visiting or downloading anything.' },
  { key: 'terms.gamesTitle', page: 'Terms', label: 'Games and accounts title', value: 'Games, accounts, and school rules.' },
  { key: 'terms.gamesBody', page: 'Terms', label: 'Games and accounts text', value: 'You are responsible for your choices when using games, links, and other services. If you are caught playing games or your game, school, or service account is suspended, restricted, or disciplined as a result, you cannot place the blame on Bobby or hold Bobby responsible for that outcome. Follow the rules that apply to you.' },
  { key: 'terms.decisionsTitle', page: 'Terms', label: 'Outside decisions title', value: 'Outside decisions.' },
  { key: 'terms.decisionsBody', page: 'Terms', label: 'Outside decisions text', value: 'Bobby does not control third-party websites, game platforms, account providers, or their decisions and cannot reverse their suspensions or penalties.' },
  { key: 'terms.limitsTitle', page: 'Terms', label: 'Limits title', value: 'Limits.' },
  { key: 'terms.limitsBody', page: 'Terms', label: 'Limits text', value: 'To the extent permitted by applicable law, Bobby is not responsible for losses or consequences resulting from third-party sites or your use of this site.' },
  { key: 'terms.note', page: 'Terms', label: 'Closing note', value: 'These terms do not limit any rights or protections that cannot legally be excluded.' },
  { key: 'shared.footer', page: 'Shared', label: 'Footer copyright', value: "© Copyrighted by Spud / Bobby's Web" }
];

export function defaultSiteContent() {
  return Object.fromEntries(SITE_TEXT_FIELDS.map(({ key, value }) => [key, value]));
}