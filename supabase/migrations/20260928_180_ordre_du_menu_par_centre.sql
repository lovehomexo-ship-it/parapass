-- L'ordre du menu de gauche était figé dans le code, dans l'ordre où les écrans
-- ont été écrits. Chaque DZ travaille autrement : une école ouvre sur
-- l'Académie, un centre à forte activité tandem sur son planning.
--
-- La colonne ne contient QUE ce que le centre a explicitement rangé. Un module
-- souscrit plus tard — l'avionnage, le tandem — n'y figure pas : il se range
-- alors à sa place par défaut, sans que personne ait rien à refaire. Un module
-- résilié y reste sans effet, et retrouve sa place si le centre y revient.
alter table centres add column if not exists ordre_menu text[];

comment on column centres.ordre_menu is
  'Ordre des entrées du menu du centre, par clé de section. Partiel par nature : '
  'ce qui n''y figure pas se range à sa place par défaut. Null = ordre par défaut.';
