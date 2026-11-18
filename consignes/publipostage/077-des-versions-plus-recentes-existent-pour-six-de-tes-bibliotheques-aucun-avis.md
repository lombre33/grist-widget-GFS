# 077 · Des versions plus récentes existent pour six de tes bibliothèques : aucun avis de sécurité, à ton rythme

App : Publipostage+ · posée le 18/11/2026 · remplace rien · décision du porteur du 18/11 (« toi, mets une consigne quand tu vois une montée de version ») · quand : après ta 065 (la 076 te laisse la coder), sans urgence ; du code dans ton app (versions de ta liste) pour les trois premières ; les trois autres sont à étudier

## Quoi

Relevé du 18/11 (registre npm), sur ta liste de bibliothèques à `8b846f5`. **Aucune n'a d'avis de sécurité publié** ; ExcelJS 4.4.0 et pdf-lib 1.17.1 sont à jour.

**1. À prendre, sans risque pour l'interface** (correctif ou version mineure) :

| Bibliothèque | Ta version | Dernière stable |
|---|---|---|
| docx (et ses graphiques) | 9.15.1 | 9.15.4 |
| JSZip | 3.10.1 | 3.10.2 |
| TipTap (et les paquets qui le suivent) | 3.31.3 | 3.34.0 |

**2. À étudier, sans urgence** (version majeure, l'interface peut changer) :

| Bibliothèque | Ta version | Dernière stable | Remarque |
|---|---|---|---|
| marked | 15.0.12 | 18.2.1 | trois versions majeures |
| qrcode-generator | 1.4.4 | 2.0.4 | |
| pdfmake | 0.2.7 | 0.3.14 | refonte de l'interface ; Grist-BI a la même 0.2.7 : à ne monter ni seule ni sans lire le guide de la 0.3 |

**3. Quand tu montes l'une d'elles, dis-le dans « Changements qui touchent GFS » de ta page d'état**, avec la version : GFS réécrit sa copie (docx, JSZip, marked, qrcode-generator, pdfmake : celles de ta liste qu'il tient pour toi) dans le lot qui lit ta demande. **TipTap est le cas particulier** : l'écriture en direct de GFS est construite pour la même version de TipTap que ton éditeur (une seule copie de ProseMirror, sinon le curseur des autres disparaît) ; GFS la refait dans le même lot, si tu le dis.

Ton Dependabot propose sans doute déjà ces montées : cette consigne ne les remplace pas, elle dit seulement ce que GFS en fait.

## Pourquoi

GFS relève désormais les dernières versions stables de toutes les bibliothèques de la suite (étude « Dépendances », fenêtre prévue dans les réglages de GFS) et, décision du porteur du 18/11, pose une consigne à chaque app dont une bibliothèque a une version plus récente. Ce n'est pas un avis de sécurité ici : rien ne presse, et ta 065 passe avant.

## Fait quand

`GFS-ETAT.md` dit « 077 · lue » ; chaque montée que tu fais est ensuite dite dans « Changements qui touchent GFS » avec la version.
