// middleware/verifyToken.js

const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_SECRET || 'your-secret-key'; // Utiliser une clé secrète pour signer le token

// Middleware de vérification du token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']; // Récupère le token dans l'en-tête 'Authorization'

    if (!token) {
        return res.status(403).send('Accès refusé : Aucun token fourni');
    }

    // Enlever le "Bearer " du token si présent
    const tokenWithoutBearer = token.startsWith('Bearer ') ? token.slice(7, token.length) : token;

    // Vérifier la validité du token
    jwt.verify(tokenWithoutBearer, secretKey, (err, decoded) => {
        if (err) {
            return res.status(403).send('Token invalide');
        }

        // Si le token est valide, ajouter les informations de l'utilisateur au requête
        req.user = decoded; // Décodage du token pour récupérer les informations de l'utilisateur
        next(); // Continuer vers la route suivante
    });
};

module.exports = verifyToken;
