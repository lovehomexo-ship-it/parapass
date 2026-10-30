-- LA PHOTO DE FOND DU CENTRE — retour du DT de Rochefort : que l'application
-- soit à l'image de la DZ. Le fichier vit dans le seau `centre-logos`, sous
-- `logo-<centre>.fond.jpg` : mêmes droits que le logo (seul un admin du centre
-- écrit), aucune nouvelle règle de stockage.
alter table public.centres add column if not exists fond_url text;
