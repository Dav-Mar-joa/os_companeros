const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const http = require('http');
const app = express();
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server);
const { MongoClient, ObjectId } = require('mongodb');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const session = require('express-session');

app.use(cookieParser());

const sessionMiddleware = session({
    secret: 'my-application-oscompaneros', 
    resave: false, 
    saveUninitialized: false, 

    cookie: { 
        secure: false, 
    },
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

const connectionString = process.env.MONGODB_URI;
const client = new MongoClient(connectionString);
const dbName = process.env.MONGODB_DBNAME;

let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db(dbName);
        console.log('Connecté à la base de données MongoDB');
    } catch (err) {
        console.error('Erreur de connexion à la base de données :', err);
    }
}

connectDB();

// Définir Pug comme moteur de vues
app.set('view engine', 'pug');

// Définir le chemin du dossier 'views'
app.set('views', path.join(__dirname, 'views'));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Middleware pour parser les données du formulaire
app.use(bodyParser.urlencoded({ extended: false }));

io.use((socket, next) => {
    const req = socket.request;
    const res = req.res || {};

    session({
        secret: 'my-application-oscompaneros',
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false }
    })(req, res, (err) => {
        if (err) {
            console.error('Erreur de session Socket.IO:', err);
            return next(err);
        }

        //console.log('Session Socket.IO:', req.session);
         // Afficher la session pour vérifier si l'utilisateur est bien défini
         //console.log("req.sssion : ", req.session.user);
        if (req.session && req.session.user) {
            socket.username = req.session.user.username; // Assurez-vous que le user est bien dans la session
        } else {
            socket.username = 'Anonyme'; // Valeur par défaut si le nom d'utilisateur n'est pas trouvé
        }

        console.log("Socket username : ", socket.username);

        req.session.save((err) => {
            if (err) {
                console.error('Erreur lors de la sauvegarde de la session Socket.IO:', err);
            } else {
                console.log('Session Socket.IO sauvegardée.');
            }
        });
        next();
    });
});

const transporter = nodemailer.createTransport({
    host: 'sandbox.smtp.mailtrap.io',
    port: 2525,
    auth: {
      user: '4f82b80e4f4e33',
      pass: '400d03e2790f20'
    },
    secure: false, // STARTTLS est requis
    tls: {
      rejectUnauthorized: false
    },
    debug: true, // Active le debug
  });

// Route pour soumettre des tâches
app.post('/', async (req, res) => {
    const user = req.session.user || "";
    const task = {
        id: uuidv4(),
        name: req.body.task,
        idUser:user._id,
        date: new Date(),
        // username: req.session.user ? req.session.user.username : "Anonyme",
        username: user.username || "Anonyme",
        avatar: req.session.user ? req.session.user.avatar : "/assets/avatar/default.png",
        responses: []  
    };
    console.log("task : ",task)

    try {
        const collection = db.collection(process.env.MONGODB_COLLECTION);
        await collection.insertOne(task);
        res.redirect('/?success=true'); // Redirection avec un paramètre de succès
    } catch (err) {
        console.error('Erreur lors de l\'ajout de la tâche :', err);
        res.status(500).send('Erreur lors de l\'ajout de la tâche');
    }
});

// Route pour la page d'accueil
app.get('/', async (req, res) => {
    const success = req.query.success === 'true';
    const successCourse = req.query.successCourse === 'true';
    const user = req.session.user || "";
    try {
        if (!user) {
            return res.redirect('/login'); // Redirection si l'utilisateur n'est pas connecté
        }

        const collection = db.collection(process.env.MONGODB_COLLECTION);
        const collectionUsers = db.collection('Users');

        // Récupération de l'utilisateur connecté
        const currentUser = await collectionUsers.findOne({ _id: user._id });

        if (!currentUser) {
            return res.status(400).send("Utilisateur introuvable !");
        }

        // Récupérer les IDs des amis
        const friendsIds = currentUser.friends || [];

        // Ajouter l'ID de l'utilisateur connecté pour inclure ses propres messages
        friendsIds.push(currentUser._id);

        // Filtrer les tâches par `idUser`
        const tasks = await collection
            .find({ idUser: { $in: friendsIds } }) // Filtre par les IDs des amis et de l'utilisateur
            .sort({ date: -1 })
            .toArray();


        res.render('index', {
            title: 'Mon site',
            message: 'Bienvenue sur ma montre digitale',
            tasks: tasks || [],
            successCourse,
            success,
            user
        });
    } catch (err) {
        console.error('Erreur lors de la récupération des tâches :', err);
        res.status(500).send('Erreur lors de la récupération des tâches');
    }
});

app.get('/login', async (req, res) => {
        res.render('login');
});

app.post('/login', async (req, res) => {

     const user={
        username:req.body.username,
        password:req.body.password
     }

    try {
        const collection = db.collection('Users');
        const userLogged = await collection.findOne({userName:user.username})
        if(userLogged && userLogged.password===user.password ){
                
            req.session.user = {
                 _id: userLogged._id,
                username: userLogged.userName,
                firstname : userLogged.firstname,
                lastname : userLogged.lastname,
                email : userLogged.email,
                avatar: userLogged.avatar 
            }  
                if(userLogged.isAdmin==="y"){
                    console.log("dans admin")
                    res.redirect('/admin')
                }
                else{
                    console.log("users")
                    res.redirect('/chat') 
                }
        }

        else{
            res.render('login',{
                message:"Login ou mot de pass erroné !"
            })
        };
     } catch (err) {
        console.error('Erreur lors de la récupération des tâches :', err);
        res.status(500).send('Erreur lors de la récupération des tâches');
    }
});
app.get('/find', async (req, res) => {
    const user = req.session.user || "";

    const userId = req.session.user._id || "";
    // console.log("dans find userID",user)

    const usersLoggedFriends = await db.collection('Users').find({_id:{$eq:userId}, isAdmin: { $ne: "y" }}).toArray();

    if (!usersLoggedFriends[0].friends) {
        // Si la propriété 'friends' n'existe pas, on l'initialise avec un tableau vide
        usersLoggedFriends[0].friends = [];
    }
     try {
        const users = await db.collection('Users')
    .find({ 
        _id: { 
            $ne: userId,
            $nin:usersLoggedFriends[0].friends
        },
        isAdmin: { $ne: "y" }
    })
    .sort({userName:1})
    .toArray();
        res.render('find',{
            user,
            users
        })
        ;
     } catch (error) {
        console.error('Erreur lors de la récupération des userst :', err);
        res.status(500).send('Erreur lors de la récupération des users');
     }
});
app.post('/addUser', async (req, res) => {
    try {

        const { userId } = req.body; 
        const currentUserId = req.session.user._id;

        if (!req.session.user) {
            return res.status(401).send('Utilisateur non connecté');
        }

        if (!userId) {
            return res.status(400).send('ID de l\'ami manquant');
        }

        const userToAdd = await db.collection('Users').findOne({ _id: userId });
        if (!userToAdd) {
            return res.status(404).send('Utilisateur non trouvé');
        }

        // Vérifiez si l'utilisateur est déjà un ami
        const currentUser = await db.collection('Users').findOne({ _id: currentUserId });
        if (currentUser.friends && currentUser.friends.includes(userId)) {
            return res.status(400).send('Cet utilisateur est déjà votre ami');
        }

        // Transactions pour ajouter les deux utilisateurs dans leurs listes d'amis
        await db.collection('Users').updateOne(
            { _id: currentUserId },
            { $push: { friends: userId } }
        );
        await db.collection('Users').updateOne(
            { _id: userId },
            { $push: { friends: currentUserId } }
        );

        // Synchronisez les données avec la session
        const updatedUser = await db.collection('Users').findOne({ _id: currentUserId });
        req.session.user = updatedUser;

        res.redirect('/find');
    } catch (err) {
        console.error('Erreur lors de l\'ajout de l\'utilisateur à la liste des amis :', err);
        res.status(500).send('Erreur serveur');
    }
});

app.get('/chat',async (req,res)=>{
    const success = req.query.success === 'true';
    const successCourse = req.query.successCourse === 'true';
    const user = req.session.user || "";

    try {
        if (!user) {
            return res.redirect('/login'); // Redirection si l'utilisateur n'est pas connecté
        }

        const collection = db.collection(process.env.MONGODB_COLLECTION);
        const collectionUsers = db.collection('Users');

        // Récupération de l'utilisateur connecté
        const currentUser = await collectionUsers.findOne({ _id: user._id });

        if (!currentUser) {
            return res.status(400).send("Utilisateur introuvable !");
        }

        // Récupérer les IDs des amis
        const friendsIds = currentUser.friends || [];

        // Ajouter l'ID de l'utilisateur connecté pour inclure ses propres messages
        friendsIds.push(currentUser._id);

        // Filtrer les tâches par `idUser`
        const tasks = await collection
            .find({ idUser: { $in: friendsIds } }) // Filtre par les IDs des amis et de l'utilisateur
            .sort({ date: -1 })
            .toArray();


        res.render('chat', {
            title: 'Mon site',
            message: 'Bienvenue sur ma montre digitale',
            tasks: tasks || [],
            successCourse,
            success,
            user
        });
    } catch (err) {
        console.error('Erreur lors de la récupération des tâches :', err);
        res.status(500).send('Erreur lors de la récupération des tâches');
    }
})

// app.get('/chatPublic', async (req, res) => {
//     const success = req.query.success === 'true';
//     const successCourse = req.query.successCourse === 'true';
//     const user = req.session.user || '';
//     console.log("Nom d'utilisateur dans la session (HTTP) :", user);


//     try {
//         if (!user) {
//             return res.redirect('/login'); // Redirection si l'utilisateur n'est pas connecté
//         }

//         const collection = db.collection(process.env.MONGODB_COLLECTION);
//         const collectionUsers = db.collection('Users');

//         const collectionMessages = db.collection('Chat');
//         const messages = await collectionMessages.find().sort({ date: 1 }).toArray(); // Tri par date croissante

//         // Récupération de l'utilisateur connecté
//         const currentUser = await collectionUsers.findOne({ _id: user._id });

//         if (!currentUser) {
//             return res.status(400).send("Utilisateur introuvable !");
//         }

//         // // Récupérer les IDs des amis
//         // const friendsIds = currentUser.friends || [];
//         // friendsIds.push(currentUser._id);

//         // // Filtrer les tâches par `idUser`
//         // const tasks = await collection
//         //     .find({ idUser: { $in: friendsIds } }) // Filtre par les IDs des amis et de l'utilisateur
//         //     .sort({ date: -1 })
//         //     .toArray();

//         res.render('chatPublic', {
//             title: 'Mon site',
//             message: 'Bienvenue sur ma montre digitale',
//             successCourse,
//             success,
//             user,
//             messages // Passer les messages au template
//         });
//     } catch (err) {
//         console.error('Erreur lors de la récupération des tâches :', err);
//         res.status(500).send('Erreur lors de la récupération des tâches');
//     }
// });
app.get('/chatPublic', async (req, res) => {
    const success = req.query.success === 'true';
    const successCourse = req.query.successCourse === 'true';
    const user = req.session.user || '';
    console.log("Nom d'utilisateur dans la session (HTTP) :", user);


    try {
        if (!user) {
            return res.redirect('/login'); // Redirection si l'utilisateur n'est pas connecté
        }

        const collection = db.collection(process.env.MONGODB_COLLECTION);
        const collectionUsers = db.collection('Users');

        const collectionMessages = db.collection('Chat');
        const messages = await collectionMessages.find().sort({ date: 1 }).toArray(); // Tri par date croissante

        // Récupération de l'utilisateur connecté
        const currentUser = await collectionUsers.findOne({ _id: user._id });

        if (!currentUser) {
            return res.status(400).send("Utilisateur introuvable !");
        }

        // // Récupérer les IDs des amis
        // const friendsIds = currentUser.friends || [];
        // friendsIds.push(currentUser._id);

        // // Filtrer les tâches par idUser
        // const tasks = await collection
        //     .find({ idUser: { $in: friendsIds } }) // Filtre par les IDs des amis et de l'utilisateur
        //     .sort({ date: -1 })
        //     .toArray();

        res.render('chatPublic', {
            title: 'Mon site',
            message: 'Bienvenue sur ma montre digitale',
            successCourse,
            success,
            user,
            messages // Passer les messages au template
        });
    } catch (err) {
        console.error('Erreur lors de la récupération des tâches :', err);
        res.status(500).send('Erreur lors de la récupération des tâches');
    }
}); 
// app.post('/delUser', async (req, res) => {
//     try {
//         const { userId } = req.body; // ID de l'utilisateur à enlever
//         const currentUser = req.session.user;

//         if (!currentUser) {
//             return res.status(401).send('Utilisateur non connecté');
//         }

//         if (!userId) {
//             return res.status(400).send('ID de l\'ami manquant');
//         }

//         // Vérifie si l'utilisateur à supprimer existe
//         const userToRemove = await db
//             .collection('Users')
//             .findOne({ _id: userId });
 
//         if (!userToRemove) {
//             return res.status(404).send('Utilisateur non trouvé');
//         }

//         // Initialisation de la liste d'amis si elle n'existe pas
//         if (!currentUser.friends) {
//             currentUser.friends = [];
//         }

//         // Retirer l'utilisateur de la liste d'amis de l'utilisateur actuel
//         await db.collection('Users').updateOne(
//             { _id: currentUser._id }, // Identifie l'utilisateur actuel
//             { $pull: { friends: userId } } // Retirer l'ami de la liste
//         );

//         // Retirer l'utilisateur actuel de la liste des amis de l'utilisateur à supprimer
//         await db.collection('Users').updateOne(
//             { _id: userToRemove._id }, // Identifie l'utilisateur à supprimer
//             { $pull: { friends: currentUser._id } } // Retirer l'utilisateur actuel de la liste des amis de l'autre utilisateur
//         );

//         // Met à jour la session
//         req.session.user = currentUser;

//         console.log('Liste des amis mise à jour :', currentUser.friends);

//         // Redirige vers la page précédente
//         res.redirect('/profil');
//     } catch (err) {
//         console.error('Erreur lors de la suppression de l\'utilisateur dans la liste des amis :', err);
//         res.status(500).send('Erreur serveur');
//     }
// });
// app.post('/adminDelUser', async (req, res) => {
//     try {
//         const { userId } = req.body; // ID de l'utilisateur à supprimer

//         if (!userId) {
//             return res.status(400).send('ID de l\'utilisateur manquant');
//         }
//         const collectionMessage = db.collection(process.env.MONGODB_COLLECTION);
//         const collection = db.collection('Users');

//         // Vérifier si l'utilisateur existe
//         const userToDelete = await collection.findOne({ _id: userId });
//         if (!userToDelete) {
//             return res.status(404).send('Utilisateur non trouvé');
//         }

//         // Supprimer l'utilisateur
//         await collection.deleteOne({ _id: userId });

//         console.log(`Utilisateur avec l'ID ${userId} supprimé.`);

//         // Récupérer la liste mise à jour des utilisateurs pour l'administration
//         const users = await collection
//             .find({ isAdmin: { $ne: "y" } }) // Exclure les administrateurs
//             .toArray();

//         res.render('admin', {
//             users,
//             message: `Utilisateur ${userToDelete.userName} supprimé avec succès.`
//         });
//     } catch (err) {
//         console.error('Erreur lors de la suppression de l\'utilisateur :', err);
//         res.status(500).send('Erreur serveur');
//     }
// });

// app.post('/adminDelUser', async (req, res) => {
//     try {
//         const { userId } = req.body; // ID de l'utilisateur à supprimer
//         console.log("userId : ",userId)
//         if (!userId) {
//             return res.status(400).send('ID de l\'utilisateur manquant');
//         }

//         const collectionMessage = db.collection(process.env.MONGODB_COLLECTION); // Collection des messages
//         console.log("collectionMessage : ",collectionMessage)
//         const collection = db.collection('Users'); // Collection des utilisateurs

//         // Vérifier si l'utilisateur existe
//         const userToDelete = await collection.findOne({ _id: userId });
//         console.log("userToDelete : ",userToDelete)
//         if (!userToDelete) {
//             return res.status(404).send('Utilisateur non trouvé');
//         }

//         // Supprimer les messages associés à l'utilisateur
//         const deleteMessagesResult = await collectionMessage.deleteMany({ idUser: userId });
//         console.log("deleteMessage : ",deleteMessagesResult)
//         console.log(`${deleteMessagesResult.deletedCount} message(s) supprimé(s) pour l'utilisateur ${userId}.`);

//         // Supprimer l'utilisateur
//         const deleteUserResult = await collection.deleteOne({ _id: userId });

//         console.log("deleteUserResult : ",deleteMessagesResult)
//         if (deleteUserResult.deletedCount === 1) {
//             console.log(`Utilisateur avec l'ID ${userId} supprimé.`);
//         }

//         // Récupérer la liste mise à jour des utilisateurs pour l'administration
//         const users = await collection
//             .find({ isAdmin: { $ne: "y" } }) // Exclure les administrateurs
//             .toArray();

//         res.render('admin', {
//             users,
//             message: `Utilisateur ${userToDelete.userName} et ses messages ont été supprimés avec succès.`
//         });
//     } catch (err) {
//         console.error('Erreur lors de la suppression de l\'utilisateur et des messages :', err);
//         res.status(500).send('Erreur serveur');
//     }
// });
// app.post('/adminDelUser', async (req, res) => {
//     try {
//         const userIdsToDelete = req.body.userIds; // Récupérer les IDs des utilisateurs à supprimer
        
//         if (!userIdsToDelete || !Array.isArray(userIdsToDelete) || userIdsToDelete.length === 0) {
//             return res.status(400).send('Aucun utilisateur sélectionné');
//         }

//         const collectionMessage = db.collection(process.env.MONGODB_COLLECTION); // Collection des messages
//         const collectionUser = db.collection('Users'); // Collection des utilisateurs

//         // Supprimer les messages associés aux utilisateurs
//         const deleteMessagesResult = await collectionMessage.deleteMany({
//             idUser: { $in: userIdsToDelete }
//         });

//         // Supprimer les utilisateurs
//         const deleteUsersResult = await collectionUser.deleteMany({
//             _id: { $in: userIdsToDelete }
//         });

//         console.log(`${deleteMessagesResult.deletedCount} message(s) supprimé(s).`);
//         console.log(`${deleteUsersResult.deletedCount} utilisateur(s) supprimé(s).`);

//         // Récupérer la liste mise à jour des utilisateurs pour l'administration
//         const users = await collectionUser.find({ isAdmin: { $ne: "y" } }).toArray();

//         res.render('admin', {
//             users,
//             message: `${deleteUsersResult.deletedCount} utilisateur(s) et leurs messages ont été supprimés avec succès.`
//         });
//     } catch (err) {
//         console.error('Erreur lors de la suppression des utilisateurs et des messages :', err);
//         res.status(500).send('Erreur serveur');
//     }
// });
app.post('/adminDelUser', async (req, res) => {
    try {
        const userIdsToDelete = req.body.userIds; // Récupérer les IDs des utilisateurs à supprimer
        
        if (!userIdsToDelete || !Array.isArray(userIdsToDelete) || userIdsToDelete.length === 0) {
            return res.status(400).send('Aucun utilisateur sélectionné');
        }

        const collectionMessage = db.collection(process.env.MONGODB_COLLECTION); // Collection des messages
        const collectionUser = db.collection('Users'); // Collection des utilisateurs

        // Supprimer les messages associés aux utilisateurs
        const deleteMessagesResult = await collectionMessage.deleteMany({
            idUser: { $in: userIdsToDelete }
        });

        // Supprimer les utilisateurs
        const deleteUsersResult = await collectionUser.deleteMany({
            _id: { $in: userIdsToDelete }
        });

        console.log(`${deleteMessagesResult.deletedCount} message(s) supprimé(s).`);
        console.log(`${deleteUsersResult.deletedCount} utilisateur(s) supprimé(s).`);

        // Récupérer la liste mise à jour des utilisateurs pour l'administration
        const users = await collectionUser.find({ isAdmin: { $ne: "y" } }).toArray();

        res.render('admin', {
            users,
            message: `${deleteUsersResult.deletedCount} utilisateur(s) et leurs messages ont été supprimés avec succès.`
        });
    } catch (err) {
        console.error('Erreur lors de la suppression des utilisateurs et des messages :', err);
        res.status(500).send('Erreur serveur');
    }
});

app.post('/delUser', async (req, res) => {
    try {
        const { userId } = req.body; // ID de l'utilisateur à enlever
        const currentUser = req.session.user;

        if (!currentUser) {
            return res.status(401).send('Utilisateur non connecté');
        }

        if (!userId) {
            return res.status(400).send('ID de l\'ami manquant');
        }

        // Vérifie si l'utilisateur à supprimer existe
        const userToRemove = await db
            .collection('Users')
            .findOne({ _id: userId });

        if (!userToRemove) {
            return res.status(404).send('Utilisateur non trouvé');
        }

        // Initialisation de la liste d'amis si elle n'existe pas
        if (!currentUser.friends) {
            currentUser.friends = [];
        }

        // Retirer l'utilisateur de la liste d'amis de l'utilisateur actuel
        await db.collection('Users').updateOne(
            { _id: currentUser._id }, // Identifie l'utilisateur actuel
            { $pull: { friends: userId } } // Retirer l'ami de la liste
        );

        // Retirer l'utilisateur actuel de la liste des amis de l'utilisateur à supprimer
        await db.collection('Users').updateOne(
            { _id: userToRemove._id }, // Identifie l'utilisateur à supprimer
            { $pull: { friends: currentUser._id } } // Retirer l'utilisateur actuel de la liste des amis de l'autre utilisateur
        );

        // Met à jour la session avec les données les plus récentes
        const updatedUser = await db.collection('Users').findOne({ _id: currentUser._id });
        req.session.user = updatedUser;

        console.log('Liste des amis mise à jour :', updatedUser.friends);

        // Redirige vers la page précédente
        res.redirect('/profil');
    } catch (err) {
        console.error('Erreur lors de la suppression de l\'utilisateur dans la liste des amis :', err);
        res.status(500).send('Erreur serveur');
    }
});


// app.get('/profil', async (req, res) => {
//     const user = req.session.user || "";

//     const userId = req.session.user._id || "";
//     const usersLoggedFriends = await db.collection('Users')
//     .find({_id:{$eq:userId}})
//     .toArray();

//     let nbUsersLoggedFriends = 0
   
//     if (usersLoggedFriends[0].friends) {
//         nbUsersLoggedFriends = usersLoggedFriends[0].friends.length 
//     }

//     const friendsId = usersLoggedFriends[0].friends || []; // Tableau des IDs des amis
//         const friends = await db.collection('Users')
//             .find({ _id: { $in: friendsId } })
//             // .project({ userName: 1,_id : 0}) 
//             // .sort({userName:1})
//             .sort({userName:1})
//             .toArray();

//         res.render('profil',{
//             user,
//             nbUsersLoggedFriends,
//             friends
//         })
//         ;
// });
app.get('/profil', async (req, res) => {
    try {
        const user = req.session.user || "";
        const userId = user._id || "";

        if (!userId) {
            return res.status(401).send('Utilisateur non connecté');
        }

        // Récupère les informations de l'utilisateur depuis la base de données
        const usersLoggedFriends = await db.collection('Users')
            .find({ _id: { $eq: userId } })
            .toArray();

        let nbUsersLoggedFriends = 0;
        if (usersLoggedFriends[0].friends) {
            nbUsersLoggedFriends = usersLoggedFriends[0].friends.length;
        }

        const friendsId = usersLoggedFriends[0].friends || []; // Tableau des IDs des amis
        const friends = await db.collection('Users')
            .find({ _id: { $in: friendsId } })
            .sort({ userName: 1 })
            .toArray();

        // Met à jour les informations de l'utilisateur dans la session
        const updatedUser = await db.collection('Users').findOne({ _id: userId });
        req.session.user = updatedUser;

        // Rend la vue avec les informations mises à jour
        res.render('profil', {
            user: updatedUser, // Utiliser les données mises à jour
            nbUsersLoggedFriends,
            friends
        });
    } catch (err) {
        console.error('Erreur lors de la récupération du profil :', err);
        res.status(500).send('Erreur serveur');
    }
});


app.get('/register', async (req, res) => {

        res.render('register');

});
app.post('/register', async (req, res) => {
    const date = new Date()
    const day=date.getDate()
    const month=date.getMonth()+1
    const year=date.getFullYear()
    const dateAccount=day+'/'+month+'/'+year
    const user = {
        _id: uuidv4(),
        userName: req.body.username,
        firstname: req.body.firstname,
        avatar:req.body.avatar,
        lastname: req.body.lastname,
        // genre: req.body.genre,
        email: req.body.email,
        // telephone: req.body.telephone,
        // age: req.body.age,
        // presentation: req.body.presentation,
        // centreInterets: req.body.centreInterets,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        isAdmin:"n",
        date:dateAccount
    };
    console.log(dateAccount)

    const collection = db.collection('Users'); // Utiliser la collection "users"
    const userEmail = await collection.findOne({ email: user.email });

        if(!userEmail){
            if(user.password===user.confirmPassword){
                    try {
                        await collection.insertOne(user);
                        res.redirect('/login'); // Redirection avec un paramètre de succès pour les courses
                    } catch (err) {
                        console.error('Erreur lors de l\'ajout du compte :', err);
                        res.status(500).send('Erreur lors de l\'ajout du compte');
                    }   
            }
            else{
                res.render('register',{
                    messagePsw:"Passwords do not match !"
                })
            }
        }
        else{
            res.render('register',{
                messageEmail:"Email déja utilisé !"
            })
        }
              
});
app.get('/admin', async (req, res) => {
    console.log('dans admin get');
    try {
        const collection = db.collection('Users');
        let nbUsers = await collection.countDocuments()
        nbUsers=nbUsers-1
        // nbUsers=nbUsers-1
        console.log("nbUSERS ",nbUsers) // Utiliser la collection "Users"
        const users = await collection
        .find({ isAdmin: { $ne: "y"} })
        .toArray();

        res.render('admin', {
            users,
            nbUsers // Passe les utilisateurs au template
        });
    } catch (err) {
        console.error("Erreur lors de la récupération des utilisateurs :", err);
        res.status(500).send("Erreur lors de la récupération des utilisateurs");
    }
});

app.post('/admin', async (req, res) => {
    const { userId } = req.body;
    console.log('del user', userId);
    try {
        const collection = db.collection('Users');
        // Supprimer l'utilisateur
        await collection.deleteOne({ _id: userId });
        let nbUsers = await collection.countDocuments()
        nbUsers=nbUsers-1
        console.log("nbUSERS ",nbUsers)
        // Récupérer à nouveau la liste des utilisateurs après la suppression
        const users = await collection
        .find({ isAdmin: { $ne: "y"} })
        .toArray();

        res.render('admin', {
            users,
            nbUsers // Passe les utilisateurs après suppression au template
        });
    } catch (err) {
        console.error('Erreur lors de la suppression de l\'utilisateur :', err);
        res.status(500).send('Erreur lors de la suppression de l\'utilisateur');
    }
});
app.get('/password-email', async (req, res) => {

        res.render('password-email');
});

// app.post('/password-email', (req, res) => {
//     const email = req.body.email;
//     // console.log(email)
  
//     // Vérifiez si un email est fourni
//     if (!email) {
//       return res.status(400).send('Email is required');
//     }
  
//     // Contenu de l'email
//     const mailOptions = {
//       from: "alt.fi-0ox8z6xo@yopmail.com",
//       to: email,
//       subject: 'Password Recovery',
//       text: 'This is your password recovery email.',
//     };
  
//     // Envoyer l'email
//     transporter.sendMail(mailOptions, (error, info) => {
//       if (error) {
//         console.error(error);
//         return res.status(500).send('Error sending email');
//       }
//       console.log('Email sent: ' + info.response);
//       res.send('Email sent successfully');
//     });
//   });

app.post('/password-email', (req, res) => {
    const email = req.body.email;
    console.log("email : ",email)
    // Vérifiez si un email est fourni
    if (!email) {
      return res.status(400).send('Email is required');
    }
  
    const mailOptions = {
        from: 'apismtp@mailtrap.io', // L'email de l'expéditeur
        to: email, // Remplacez par l'email du destinataire
        subject: 'Password Recovery',
        text: 'This is your password recovery email.',
      };
    // Envoyer l'email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(error);
        return res.status(500).send('Error sending email');
      }
      console.log('Email sent: ' + info.response);
      res.send('Email sent successfully');
    });
  });
app.delete('/delete-task/:id', async (req, res) => {
    const taskId = req.params.id;
    try {
        const collection = db.collection(process.env.MONGODB_COLLECTION);
        await collection.deleteOne({ _id: new ObjectId(taskId) });
        res.status(200).send('Tâche supprimée avec succès');
    } catch (err) {
        console.error('Erreur lors de la suppression de la tâche :', err);
        res.status(500).send('Erreur lors de la suppression de la tâche');
    }
});
app.delete('/delete-course/:id', async (req, res) => {
    const courseId = req.params.id;
    try {
        const collection = db.collection('Courses');
        await collection.deleteOne({ _id: new ObjectId(courseId) });
        res.status(200).send('Course supprimée avec succès');
    } catch (err) {
        console.error('Erreur lors de la suppression de la course :', err);
        res.status(500).send('Erreur lors de la suppression de la course');
    }
})
// Démarrer le serveur sur le port spécifié dans .env ou sur 4000 par défaut
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
})

let userConnected=[]

io.on('connection', (socket) => {
    const req = socket.request;
    const user = req.session.user || {}; // Récupérer les informations de l'utilisateur connecté

    console.log('Nouvelle connexion:', socket.id);
    console.log('Nom d\'utilisateur connecté :', user || 'Anonyme');

    userConnected.push(user._id)
        let nbConnected = userConnected.length
        console.log("nb connecté : ",nbConnected)
         // Envoyer le nombre de connectés au client actuel
        socket.emit('updateNbConnected', nbConnected);

        // Informer tous les clients d'une mise à jour
        io.emit('updateNbConnected', nbConnected)

    socket.on('messageChat', async (message) => {
        console.log("Message reçu:", message, "de", user.username || 'Anonyme');
    
        const date = new Date();
        const day = date.getDate();
        const month = date.getMonth();
        const min = date.getMinutes().toString().padStart(2, '0'); // Format 2 chiffres
        const hour = date.getHours().toString().padStart(2, '0');  // Format 2 chiffres
        const timeMessage = `${day}/${month+1} ( ${hour }:${min} )`; // Format HH:mm
        
        const messageData = {
            content: message,
            time: timeMessage,
            username: user.username || 'Anonyme',
            avatar:user.avatar,
            userId: user._id || null
        };
    
        try {
            const collectionMessages = db.collection('Chat');
            await collectionMessages.insertOne(messageData);
            console.log('Message enregistré dans la base de données:', messageData);
    
            // Diffuser le message aux autres clients
            io.emit('nouveauMessage', messageData,nbConnected); // Envoie à tous les clients connectés
        } catch (err) {
            console.error('Erreur lors de l\'enregistrement du message :', err);
        }
    });
    // Gestion de la déconnexion
    socket.on('disconnect', (reason) => {
        console.log('Utilisateur déconnecté:', socket.id);
        console.log('Raison:', reason);
        userConnected = userConnected.filter(item => item !== user._id);
        nbConnected = userConnected.length;
        io.emit('updateNbConnected', nbConnected); // Mise à jour après déconnexion
        if (user.username) {
            console.log(`${user.username} s'est déconnecté.`);
            
        }
    });
});


