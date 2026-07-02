# ParaPass — Instructions Claude

## Règles de fin de session — OBLIGATOIRES

1. Avant tout push : `npm run build` doit passer sans erreur. Jamais de push avec un build cassé.
2. À la fin de CHAQUE session de travail : `git add -A`, commit avec un message clair, `git push origin main`. Ne jamais terminer une session avec des modifications non commitées.
3. Après le push, rappeler de vérifier le déploiement Vercel (statut Ready) et de faire un hard refresh sur parapass.fr.
4. Ne JAMAIS afficher un secret (clé privée, token, mot de passe) dans le terminal ou une réponse. Les secrets se manipulent via des fichiers temporaires supprimés après usage.
