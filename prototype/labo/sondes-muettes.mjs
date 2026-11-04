// Les avertissements de GFS que les passes du labo comptent. Depuis le 04/11, GFS écrit en console, au bout de 15 s, qu'une app n'a pas dit « prête » et où il a attendu (js/session.js : la cause d'une
// app muette est dans la console de son cadre). Certaines sondes du labo se taisent par construction : la sonde O ne dit « prête » que pour montrer sa question, les sondes L, P, R, S et T jamais. Une
// passe qui les garde ouvertes plus de 15 s provoque donc cet avertissement sans que GFS y soit pour rien : celui-là ne compte pas. Celui d'une vraie app (`GFS : form : pas de « prête »…`) compte toujours.
const SILENT_PROBE = /^GFS : sonde-[a-z]+ : pas de « prête » en \d+ s sur /;

export const isSilentProbeWarning = text => SILENT_PROBE.test(text);

// Un avertissement de GFS que la passe doit compter.
export const isGfsWarning = text => text.startsWith('GFS') && !isSilentProbeWarning(text);
