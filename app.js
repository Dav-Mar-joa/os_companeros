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
const bcrypt = require('bcryptjs');
const { Console } = require('console');


app.use(cookieParser());

// const sessionMiddleware = session({
//     secret: 'my-application-oscompaneros', 
//     resave: false, 
//     saveUninitialized: false, 

//     cookie: { 
//         secure: false, 
//     },
// });
// Middleware de session
// const sessionMiddleware = session({
//     secret: process.env.JWT_SECRET, 
//     resave: false, 
//     saveUninitialized: false, 
//     cookie: {
//         secure: process.env.NODE_ENV === 'production', 
//         httpOnly: true, 
//         maxAge: 1000 * 60 * 60 * 24, 
//     },
//     store: MongoStore.create({
//         mongoUrl: process.env.MONGODB_URI, 
//         ttl: 14 * 24 * 60 * 60,
//     }),
// });

// app.use(sessionMiddleware);

const sessionMiddleware = session({
    secret: process.env.JWT_SECRET || 'default-secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        dbName: 'OsCompaneros', // Nom de la base de données
        collectionName: 'production', // Nom de la collection pour les sessions
    }),
    cookie: {
        secure: false, // Mettre true en production avec HTTPS
        maxAge: 30*24 * 60 * 60 * 1000, // Durée de vie des cookies (1 jour ici)
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

// app.get('/service-worker.js', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'service-worker.js'));
// });


app.use('/profil', express.static(path.join(__dirname, 'public')));

// // Vérifie que la route manifeste fonctionne
// app.get('/manifest.json', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
//   });

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Middleware pour parser les données du formulaire
app.use(bodyParser.urlencoded({ extended: true }));

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
    console.log("user --------------------:",user)
    const pseudo = user.username
    const task = {
        id: uuidv4(),
        name: req.body.task,
        idUser:user._id,
        date: new Date(),
        // username: req.session.user ? req.session.user.username : "Anonyme",
        username: pseudo,
        // username: req.session.user ? req.session.user.username : "aaaaaaaaaa",
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

app.post('/like/:taskId', async (req, res) => {
    const user = req.session.user;

    if (!user) {
        return res.status(401).json({ error: "Utilisateur non connecté" });
    }

    const taskId = req.params.taskId;
    const userId = user._id;

    try {
        const collection = db.collection(process.env.MONGODB_COLLECTION);
        const task = await collection.findOne({ _id: new ObjectId(taskId) });

        if (!task) {
            return res.status(404).json({ error: "Tâche non trouvée" });
        }

        let update;
        if (task.likes && task.likes.includes(userId)) {
            // L'utilisateur a déjà liké -> on retire le like
            update = { $pull: { likes: userId } };
        } else {
            // L'utilisateur n'a pas liké -> on ajoute le like
            update = { $addToSet: { likes: userId } };
        }

        await collection.updateOne({ _id: new ObjectId(taskId) }, update);

        // Récupérer le nombre de likes mis à jour
        const updatedTask = await collection.findOne({ _id: new ObjectId(taskId) });
        const likeCount = updatedTask.likes ? updatedTask.likes.length : 0;

        res.json({ success: true, likeCount });
    } catch (err) {
        console.error("Erreur lors du like :", err);
        res.status(500).json({ error: "Erreur lors de la mise à jour du like" });
    }
});


app.get('/propos',async(req,res)=>{
    res.render('propos')
})

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
        // console.log('user ',user)
        // console.log('task ',tasks)

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
    const { username, password } = req.body;

    try {
        const collection = db.collection('Users');
        const userLogged = await collection.findOne({ username });



        // Vérifier si l'utilisateur existe
        if (!userLogged) {
            return res.render('login', { message: "Login ou mot de passe erroné !" });
        }
        if (userLogged.isLoggedIn) {
            return res.render('login', { message: "Ce compte est déjà connecté ailleurs." });
        }

        // Vérifier si le mot de passe correspond au hash stocké
        const isMatch = await bcrypt.compare(password, userLogged.password);
        if (!isMatch) {
            return res.render('login', { message: "Login ou mot de passe erroné !" });
        }

        await collection.updateOne(
            { _id: userLogged._id },
            { $set: { isLoggedIn: true } }
        );

        // Création de la session utilisateur après authentification réussie
        req.session.user = {
            _id: userLogged._id,
            username: userLogged.username,
            firstname: userLogged.firstname,
            lastname: userLogged.lastname,
            email: userLogged.email,
            avatar: userLogged.avatar
        };

        // Redirection selon le rôle de l'utilisateur
        if (userLogged.isAdmin === "y") {
            console.log("Utilisateur admin connecté");
            return res.redirect('/admin');
        } else {
            console.log("Utilisateur connecté :", req.session.user.username);
            return res.redirect('/chat');
        }
    } catch (err) {
        console.error("Erreur lors de la connexion :", err);
        res.status(500).send("Erreur lors de la connexion");
    }
});


// app.post('/login', async (req, res) => {

//      const user={
//         username:req.body.username,
//         password:req.body.password
//      }

//     try {
//         const collection = db.collection('Users');
//         const userLogged = await collection.findOne({username:user.username})
//         if(userLogged && userLogged.password===user.password ){
                
//             req.session.user = {
//                  _id: userLogged._id,
//                 username: userLogged.username,
//                 firstname : userLogged.firstname,
//                 lastname : userLogged.lastname,
//                 email : userLogged.email,
//                 avatar: userLogged.avatar 
//             } 
             
//                 if(userLogged.isAdmin==="y"){
//                     console.log("dans admin")
//                     res.redirect('/admin')
//                 }
//                 else{
//                     console.log("users")
//                     console.log("---------------------")
//                     console.log("user connecté : ",req.session.user.username)
//                     console.log("---------------------")
//                     res.redirect('/') 
//                 }
//         }

//         else{
//             res.render('login',{
//                 message:"Login ou mot de pass erroné !"
//             })
//         };
//      } catch (err) {
//         console.error('Erreur lors de la récupération des tâches :', err);
//         res.status(500).send('Erreur lors de la récupération des tâches');
//     }
// });
// app.post('/login', async (req, res) => {

//      const user={
//         username:req.body.username,
//         password:req.body.password
//      }

//     try {
//         const collection = db.collection('Users');
//         const userLogged = await collection.findOne({username:user.username})
//         if(userLogged && userLogged.password===user.password ){
                
//             req.session.user = {
//                  _id: userLogged._id,
//                 username: userLogged.username,
//                 firstname : userLogged.firstname,
//                 lastname : userLogged.lastname,
//                 email : userLogged.email,
//                 avatar: userLogged.avatar 
//             } 
             
//                 if(userLogged.isAdmin==="y"){
//                     console.log("dans admin")
//                     res.redirect('/admin')
//                 }
//                 else{
//                     console.log("users")
//                     console.log("---------------------")
//                     console.log("user connecté : ",req.session.user.username)
//                     console.log("---------------------")
//                     res.redirect('/') 
//                 }
//         }

//         else{
//             res.render('login',{
//                 message:"Login ou mot de pass erroné !"
//             })
//         };
//      } catch (err) {
//         console.error('Erreur lors de la récupération des tâches :', err);
//         res.status(500).send('Erreur lors de la récupération des tâches');
//     }
// });

app.get('/logout', async (req, res) => {

    if (req.session.user) {
        const collection = db.collection('Users');
        await collection.updateOne(
            { _id: req.session.user._id },
            { $set: { isLoggedIn: false } }
        );
    }
    // Supprimer la session
    req.session.destroy((err) => {
        if (err) {
            console.error('Erreur lors de la destruction de la session', err);
            return res.status(500).send('Erreur de déconnexion');
        }
        res.clearCookie('connect.sid');
        // Redirection vers la page de login après déconnexion
        res.redirect('/login');
    });
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
    .sort({username:1})
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
app.post('/find', async (req, res) => {
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
            .sort({ date: 1 })
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
        const messages = await collectionMessages.find().sort({ date: -1 }).toArray(); // Tri par date croissante

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
//             message: `Utilisateur ${userToDelete.username} supprimé avec succès.`
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
//             message: `Utilisateur ${userToDelete.username} et ses messages ont été supprimés avec succès.`
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
// app.get('/profil/:userId', async (req, res) => {
//     console.log("je suis dans la route du profil apres avatar")
//     const userId = req.params.userId;
//     // Rechercher l'utilisateur dans la base de données avec l'userId
//     console.log("userId",userId)
//     try {
//         const userProfilFriend =  await db.collection("Users").findOne({ _id: userId })
//         const friends = await db.collection("Users").findOne(
//             { _id: userId }, // Critère de recherche
//             { projection: { friends: 1 } } )
        
//         console.log(userProfilFriend)
//         console.log("friends : ",friends)

//         // Récupérer les informations des amis : avatar et username
//         const friendsInfo = await db.collection("Users").find(
//             { _id: { $in: friendsIds } }, 
//             { projection: { avatar: 1, username: 1 } } // Projection pour récupérer seulement avatar et username
//         ).toArray();

//         console.log("Informations des amis : ", friendsInfo)
//         res.render('profilFriend', {
//             userProfilFriend,
//             friends
        
//         });
//     } catch (error) {
//         console.error('Erreur lors de la récupération du profil :', err);
//         res.status(500).send('Erreur serveur');
//     }

//   });

  app.get('/profil/:userId', async (req, res) => {
    console.log("je suis dans la route du profil après avatar");
    const userId = req.params.userId;
    console.log("userId", userId);

    try {
        // Étape 1 : Récupérer l'utilisateur et ses amis
        const userProfilFriend = await db.collection("Users").findOne({ _id: userId });
        
        // Vérifier si l'utilisateur existe et s'il a des amis
        if (!userProfilFriend || !userProfilFriend.friends) {
            return res.status(404).send("Utilisateur ou amis non trouvés");
        }

        console.log("Profil de l'utilisateur : ", userProfilFriend);

        // Étape 2 : Récupérer les IDs des amis
        const friendsIds = userProfilFriend.friends; // Tableau des IDs des amis
        console.log("ID des amis : ", friendsIds);

        // Récupérer les informations des amis : avatar et username
        const friendsInfo = await db.collection("Users").find(
            { _id: { $in: friendsIds } }, 
            { projection: { avatar: 1, username: 1,  } } // Projection pour récupérer seulement avatar et username
        ).toArray();

        console.log("Informations des amis : ", friendsInfo);
        
        res.render('profilFriend', {
                        userProfilFriend,
                        friendsInfo})
    } catch (err) {
        console.log("Erreur lors de la récupération du profil ou des amis :", err);
        res.status(500).send("Erreur serveur");
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
//             // .project({ username: 1,_id : 0}) 
//             // .sort({username:1})
//             .sort({username:1})
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
            .sort({ username: 1 })
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

})
app.post('/register', async (req, res) => {
    const date = new Date();
    const dateAccount = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;

    // const day = date.getDate().toString().padStart(2, '0');
    // const month = (date.getMonth() + 1).toString().padStart(2, '0'); // +1 car les mois commencent à 0
    // const year = date.getFullYear();

    // const hours = date.getHours().toString().padStart(2, '0');
    // const minutes = date.getMinutes().toString().padStart(2, '0');
    // const seconds = date.getSeconds().toString().padStart(2, '0');

    // const dateAccount = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

    // console.log(dateAccount);

    // Vérifier que les mots de passe correspondent avant le hashage
    if (req.body.password !== req.body.confirmPassword) {
        return res.render('register', { messagePsw: "Passwords do not match!" });
    }

    // Hacher le mot de passe après validation
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    const user = {
        _id: uuidv4(),
        username: req.body.username,
        firstname: req.body.firstname,
        avatar: req.body.avatar,
        lastname: req.body.lastname,
        email: req.body.email,
        gender: req.body.gender,
        telephone: req.body.telephone || "😎 [ perso ]",
        age: req.body.age || "😎 [ perso ]",
        presentation: req.body.presentation || "😎 [ perso ]",
        centreInterets: req.body.centreInterets || "😎 [ perso ]",
        password: hashedPassword,  // ✅ On stocke uniquement le hash
        isAdmin: "n",
        date: dateAccount,
        isConnected: "n",
        isLoggedIn : false
    };

    const collection = db.collection('Users'); // Accéder à la collection "Users"
    
    try {
        const userEmail = await collection.findOne({ email: user.email });

        if (userEmail) {
            return res.render('register', { messageEmail: "Email déjà utilisé!" });
        }

        // Insérer l'utilisateur après validation
        await collection.insertOne(user);
        res.redirect('/login'); 

    } catch (err) {
        console.error("Erreur lors de l'ajout du compte :", err);
        res.status(500).send("Erreur lors de l'ajout du compte");
    }
});

//----------

// app.post('/register', async (req, res) => {
//     const date = new Date()
//     const day=date.getDate()
//     const month=date.getMonth()+1
//     const year=date.getFullYear()
//     const dateAccount=day+'/'+month+'/'+year
//     const hashedPassword = await bcrypt.hash(req.body.password, 10);
//         console.log("hashed psw :",hashedPassword)
//     const hashedPasswordConfirm = await bcrypt.hash(req.body.confirmPassword, 10);
//         console.log("hashed psw confirm:",hashedPasswordConfirm )
//     const user = {
//         _id: uuidv4(),
//         username: req.body.username,
//         firstname: req.body.firstname,
//         avatar:req.body.avatar,
//         lastname: req.body.lastname,
//         // genre: req.body.genre,
//         email: req.body.email,
//         // telephone: req.body.telephone,
//         // age: req.body.age,
//         // presentation: req.body.presentation,
//         // centreInterets: req.body.centreInterets,
//         password: hashedPassword,
//         password: req.body.password,
//         confirmPassword: req.body.confirmPassword,
//         isAdmin:"n",
//         date:dateAccount
//     };
//     console.log(dateAccount)

//     const collection = db.collection('Users'); // Utiliser la collection "users"
//     const userEmail = await collection.findOne({ email: user.email });

//         if(!userEmail){
//             if(user.password===user.confirmPassword){
//                     try {
//                         await collection.insertOne(user);
//                         res.redirect('/login'); // Redirection avec un paramètre de succès pour les courses
//                     } catch (err) {
//                         console.error('Erreur lors de l\'ajout du compte :', err);
//                         res.status(500).send('Erreur lors de l\'ajout du compte');
//                     }   
//             }
//             else{
//                 res.render('register',{
//                     messagePsw:"Passwords do not match !"
//                 })
//             }
//         }
//         else{
//             res.render('register',{
//                 messageEmail:"Email déja utilisé !"
//             })
//         }
              
// });
// app.post('/register', async (req, res) => {
//     const date = new Date()
//     const day=date.getDate()
//     const month=date.getMonth()+1
//     const year=date.getFullYear()
//     const dateAccount=day+'/'+month+'/'+year
//     const hashedPassword = await bcrypt.hash(req.body.password, 10);
//         console.log("hashed psw :",hashedPassword)
//     const user = {
//         _id: uuidv4(),
//         username: req.body.username,
//         firstname: req.body.firstname,
//         avatar:req.body.avatar,
//         lastname: req.body.lastname,
//         // genre: req.body.genre,
//         email: req.body.email,
//         // telephone: req.body.telephone,
//         // age: req.body.age,
//         // presentation: req.body.presentation,
//         // centreInterets: req.body.centreInterets,
//         password: hashedPassword,
//         password: req.body.password,
//         confirmPassword: req.body.confirmPassword,
//         isAdmin:"n",
//         date:dateAccount
//     };
//     console.log(dateAccount)

//     const collection = db.collection('Users'); // Utiliser la collection "users"
//     const userEmail = await collection.findOne({ email: user.email });

//         if(!userEmail){
//             if(user.password===user.confirmPassword){
//                     try {
//                         await collection.insertOne(user);
//                         res.redirect('/login'); // Redirection avec un paramètre de succès pour les courses
//                     } catch (err) {
//                         console.error('Erreur lors de l\'ajout du compte :', err);
//                         res.status(500).send('Erreur lors de l\'ajout du compte');
//                     }   
//             }
//             else{
//                 res.render('register',{
//                     messagePsw:"Passwords do not match !"
//                 })
//             }
//         }
//         else{
//             res.render('register',{
//                 messageEmail:"Email déja utilisé !"
//             })
//         }
              
// });
// app.get('/modificationProfil', async (req, res) => {

//     const user = req.session.user || "";
//     const userId = user._id || "";
//     const collectionUsers = db.collection('Users');

//         // Récupération de l'utilisateur connecté
//     const currentUser = await collectionUsers.findOne({ _id: user._id });
//     console.log("#############################################")
//     console.log("je suis dans get ")
//     console.log(currentUser)
//     console.log("#############################################")

//     res.render('modificationProfil',{
//         currentUser
//     });

// });
app.post('/modificationProfil', async (req, res) => {
    try {
        const user = req.session.user || "";
        const userId = user._id || "";
        
        // Affichage des informations de l'utilisateur
        console.log("-------------------------------------");
        console.log("je suis dans PROFIL ")
        console.log(user);
        console.log("-------------------------------------");
        console.log("gggggggggggggggggg",req.body);  // Pour déboguer
        // Récupération de la collection 'Users'
        const collectionUsers = await db.collection('Users');

        // Récupération de l'utilisateur connecté
        const currentUser = await collectionUsers.findOne({ _id: user._id });
        const userUpdate = {
            username: req.body.username || currentUser.username,
            firstname: req.body.firstname || currentUser.firstname,
            avatar: req.body.avatar || currentUser.avatar,
            lastname: req.body.lastname || currentUser.lastname,
            gender: req.body.gender || currentUser.gender,
            telephone: req.body.gender || currentUser.telephone, 
            presentation: req.body.presentation || currentUser.presentation,
            centreInterets: req.body.centreInterets || currentUser.centreInterets,
        }
        console.log("<<<<<<<<<<<<----->>>>>>>>>>>>>>>")
        console.log("userUpade",userUpdate)
        await collectionUsers.updateOne({ _id: user._id }, { $set: userUpdate });
        req.session.user = { ...currentUser, ...userUpdate };
        
        const collectionMessages = await db.collection('Wall');
        await collectionMessages.updateMany(
            { idUser: userId }, // Identifier les messages de cet utilisateur
            { $set: { username: userUpdate.username, avatar: userUpdate.avatar } } // Modifier les champs concernés
        );

        const collectionChat = await db.collection('Chat');
        await collectionChat.updateMany(
            { userId: userId }, // Identifier les messages de cet utilisateur
            { $set: { username: userUpdate.username, avatar: userUpdate.avatar } } // Modifier les champs concernés
        );

        res.redirect('/profil');

    } catch (error) {
        console.error("Erreur lors de la récupération de l'utilisateur :", error);
        res.status(500).send("Une erreur est survenue lors de la modification du profil");
    }
});
app.get('/modificationProfil', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login'); // Redirection si l'utilisateur n'est pas connecté
    }

    res.render('modificationProfil', { user: req.session.user });
});

// app.post('/modificationProfil', async (req, res) => {
//     try {
//         if (!req.session.user || !req.session.user._id) {
//             console.log("Aucun utilisateur en session");
//             return res.status(401).send("Utilisateur non connecté");
//         }

//         console.log("ID utilisateur en session:", req.session.user._id);

//         let userId;
//         if (req.session.user._id) {
//             userId = req.session.user._id;
//         } else {
//             console.error("L'ID de session n'est pas valide :", req.session.user._id);
//             return res.status(400).send("ID utilisateur invalide");
//         }

//         console.log("ID converti en ObjectId :", userId);

//         const collectionUsers = await db.collection('Users');
//         const currentUser = await collectionUsers.findOne({ _id: userId });

//         if (!currentUser) {
//             console.log("Utilisateur introuvable en base de données");
//             return res.status(404).send("Utilisateur introuvable");
//         }

//         const userUpdate = {
//             username: req.body.username || currentUser.username,
//             firstname: req.body.firstname || currentUser.firstname,
//             avatar: req.body.avatar || currentUser.avatar,
//             lastname: req.body.lastname || currentUser.lastname
//         };

//         console.log("Données mises à jour :", userUpdate);

//         await collectionUsers.updateOne({ _id: userId }, { $set: userUpdate });

//         req.session.user = { ...currentUser, ...userUpdate };

//         console.log("Mise à jour réussie, redirection vers /profil");
//         res.redirect('/profil'); 

//     } catch (error) {
//         console.error("Erreur lors de la modification du profil :", error);
//         res.status(500).send("Une erreur est survenue");
//     }
// });




// app.post('/modificationProfil', async (req, res) => {
//     try {
//         const user = req.session.user || "";
//         const userId = user._id || "";
        
//         if (!userId) {
//             return res.status(401).send('Utilisateur non connecté');
//         }

//         // Récupérer les nouvelles données du formulaire
//         const { username, firstname, lastname, avatar } = req.body;

//         // Affichage des données reçues pour vérification
//         console.log("Modification du profil - Données reçues :", req.body);

//         // Récupération de la collection 'Users'
//         const collectionUsers = db.collection('Users');

//         // Mise à jour de l'utilisateur dans la base de données
//         const result = await collectionUsers.updateOne(
//             { _id: userId }, // Recherche de l'utilisateur par son ID
//             { 
//                 $set: { 
//                     username, 
//                     firstname, 
//                     lastname, 
//                     avatar 
//                 }
//             }
//         );

//         // Vérification si la mise à jour a réussi
//         if (result.matchedCount > 0) {
//             // Récupérer les nouvelles informations de l'utilisateur après la mise à jour
//             const updatedUser = await collectionUsers.findOne({ _id: userId });

//             // Mettre à jour la session avec les nouvelles informations de l'utilisateur
//             req.session.user = updatedUser;

//             // Rediriger vers le profil avec les nouvelles informations
//             res.redirect('/profil');
//         } else {
//             console.log("Aucune modification effectuée.");
//             res.status(400).send("Aucune modification effectuée.");
//         }

//     } catch (error) {
//         console.error("Erreur lors de la modification du profil :", error);
//         res.status(500).send("Une erreur est survenue lors de la modification du profil.");
//     }
// });

// app.post('/modificationProfil', async (req, res) => {
//     try {
//         const user = req.session.user || "";
//         const userId = user._id || "";

//         // Affichage des informations de l'utilisateur
//         console.log("-------------------------------------");
//         console.log("je suis dans modificationProfil ");
//         console.log(user);
//         console.log("-------------------------------------");

//         // Récupération de la collection 'Users'
//         const collectionUsers = await db.collection('Users');

//         // Récupération de l'utilisateur connecté
//         const currentUser = await collectionUsers.findOne({ _id: user._id });

//         if (currentUser) {
//             // Préparer les nouvelles informations pour l'utilisateur
//             const userUpdate = {
//                 username: req.body.username || currentUser.username,
//                 firstname: req.body.firstname || currentUser.firstname,
//                 avatar: req.body.avatar || currentUser.avatar,
//                 lastname: req.body.lastname || currentUser.lastname
//             };

//             console.log("<<<<<<<<<<<<----->>>>>>>>>>>>>>>");
//             console.log("userUpdate:", userUpdate);

//             // Mise à jour de l'utilisateur dans la base de données
//             await collectionUsers.updateOne(
//                 { _id: user._id },
//                 { $set: userUpdate }
//             );

//             // Mettre à jour les données de session avec les nouvelles valeurs
//             req.session.user = { ...currentUser, ...userUpdate };

//             // Rediriger vers la page du profil ou afficher une page de confirmation
//             res.redirect('/modificationProfil');
//         } else {
//             console.log("Utilisateur introuvable");
//             res.status(404).send("Utilisateur introuvable");
//         }
//     } catch (error) {
//         console.error("Erreur lors de la récupération de l'utilisateur :", error);
//         res.status(500).send("Une erreur est survenue lors de la modification du profil");
//     }
// });


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
app.get('/adminStats', async (req, res) => {
    console.log('dans admin     statics');
    try {
        const collection = db.collection('Users');
        let nbUsers = await collection.countDocuments()
        nbUsers=nbUsers-1
        // nbUsers=nbUsers-1
        console.log("nbUSERS ",nbUsers) // Utiliser la collection "Users"
        const usersInfos = await collection
        .find({ isAdmin: { $ne: "y"}},
              { isConnected: { $eq: "y"}}

         )
        .toArray();
        const nbOnline = await collection.countDocuments({ 
            isAdmin: { $ne: "y" }, 
            isConnected: "y"
        });

        console.log("rrrrrrrrrrrrrrrrrrrr",nbOnline)
        const collectionPosts = db.collection('Wall');
        // Récupération du dernier post
        const lastPostArray = await collectionPosts.find().sort({ date: -1 }).limit(1).toArray();
        const lastPost = lastPostArray.length > 0 ? lastPostArray[0] : null; // Vérifie si un post existe
        console.log("lastPost :", lastPost ? lastPost.date : "Aucun post trouvé");

        // Récupération du dernier utilisateur inscrit
        const lastUserArray = await collection.find().sort({ date: -1 }).limit(1).toArray();
        const lastUser = lastUserArray.length > 0 ? lastUserArray[0] : null; // Vérifie si un utilisateur existe
        console.log("lastUser :", lastUser ? lastUser.username : "Aucun utilisateur trouvé");
        console.log("lastUser date:", lastUser ? lastUser.date : "Aucun utilisateur trouvé");
        let nbPosts = await collectionPosts.countDocuments()
        console.log("nbPosts :",nbPosts)

        // Formatage de la date si lastPost existe
        if (lastPost && lastPost.date) {
            const postDate = new Date(lastPost.date);
            lastPost.formattedDate = postDate.toLocaleString('fr-FR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
        }
        console.log("lastPost.formattedDate ",lastPost.formattedDate)
        // Formatage de la date si lastPost existe
        if (lastUser && lastUser.date) {
            const userDate = new Date(lastUser.date);
            console.log("userDate : ",userDate)
            // Formater la date en français
            let formattedDate = userDate.toLocaleString('fr-FR', { 
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
        
            // Réarranger la date : passer le mois en 3ème et l'heure en 4ème position
            const parts = lastUser.date.split(' ');  // Séparer la date et l'heure
            console.log ("parts ",parts)
            const dateParts = parts[0].split('/');  // Séparer jour/mois/année
            console.log("dateParts ",dateParts)
            const timeParts = parts[1].split(':');  // Séparer l'heure/minute/secondes
            console.log("timeParts ",timeParts )
        
            // Réarranger les termes
            const newFormattedDate = `${dateParts[0]}/${dateParts[1]}/${dateParts[2]} ${timeParts[0]}:${timeParts[1]}:${timeParts[2]}`;
        
            lastUser.formattedDate = newFormattedDate;
        }
        console.log("lastUser.formattedDate ",lastUser.formattedDate )
        res.render('adminStats', {
            usersInfos,
            nbUsers,
            nbPosts,
            nbOnline,
            lastPost,
            lastUser // Passe les utilisateurs au template
        });
    } catch (err) {
        console.error("Erreur lors de la récupération des utilisateurs :", err);
        res.status(500).send("Erreur lors de la récupération des utilisateurs");
    }
});

// app.post('/admin', async (req, res) => {
//     const { userId } = req.body;
//     console.log('del user', userId);
//     try {
//         const collection = db.collection('Users');
//         // Supprimer l'utilisateur
//         await collection.deleteOne({ _id: userId });
//         let nbUsers = await collection.countDocuments()
//         nbUsers=nbUsers-1
//         console.log("nbUSERS ",nbUsers)
//         // Récupérer à nouveau la liste des utilisateurs après la suppression
//         const users = await collection
//         .find({ isAdmin: { $ne: "y"} })
//         .toArray();

//         res.render('admin', {
//             users,
//             nbUsers // Passe les utilisateurs après suppression au template
//         });
//     } catch (err) {
//         console.error('Erreur lors de la suppression de l\'utilisateur :', err);
//         res.status(500).send('Erreur lors de la suppression de l\'utilisateur');
//     }
// });

// app.post('/admin', async (req, res) => {
//     const { userId } = req.body; // ID de l'utilisateur à supprimer
//     console.log('Suppression de l\'utilisateur', userId);

//     try {
//         const usersCollection = db.collection('Users');
//         const wallCollection = db.collection(process.env.MONGODB_COLLECTION);

//         // Supprimer les messages de l'utilisateur dans la collection Wall
//         await wallCollection.deleteMany({ idUser: userId });
//         console.log('Messages de l\'utilisateur supprimés des murs.');

//         // Supprimer l'utilisateur des réponses dans les murs
//         await wallCollection.updateMany(
//             { 'responses.idUser': userId },
//             { $pull: { responses: { idUser: userId } } }
//         );
//         console.log('Réponses de l\'utilisateur supprimées des murs.');

//         // Supprimer l'utilisateur des listes d'amis
//         await usersCollection.updateMany(
//             { friends: userId },
//             { $pull: { friends: userId } }
//         );
//         console.log('Utilisateur supprimé des listes d\'amis.');

//         // Supprimer l'utilisateur lui-même
//         await usersCollection.deleteOne({ _id: userId });
//         console.log('Utilisateur supprimé de la collection Users.');

//         // Récupérer les utilisateurs restants pour l'afficher dans le panneau admin
//         const users = await usersCollection
//             .find({ isAdmin: { $ne: "y" } })
//             .toArray();
//         const nbUsers = users.length;

//         res.render('admin', {
//             users,
//             nbUsers
//         });
//     } catch (err) {
//         console.error('Erreur lors de la suppression de l\'utilisateur :', err);
//         res.status(500).send('Erreur lors de la suppression de l\'utilisateur');
//     }
// });
// app.post('/admin', async (req, res) => {
//     const userId = req.body.userId; // Récupérer l'ID unique envoyé par le formulaire
//     console.log('Reçu pour suppression :', userId);

//     try {
//         const userCollection = db.collection('Users');

//         // Supprimer uniquement l'utilisateur avec l'ID correspondant
//         const result = await userCollection.deleteOne({ _id: userId });
//         if (result.deletedCount === 1) {
//             console.log(`Utilisateur supprimé : ${userId}`);
//         } else {
//             console.log(`Aucun utilisateur trouvé avec l'ID : ${userId}`);
//         }

//         // Rechargez la liste des utilisateurs après suppression
//         const users = await userCollection.find({ isAdmin: { $ne: "y" } }).toArray();
//         const nbUsers = users.length;

//         res.render('admin', { users, nbUsers });
//     } catch (err) {
//         console.error('Erreur lors de la suppression :', err);
//         res.status(500).send('Erreur serveur lors de la suppression');
//     }
// });

// app.post('/admin', async (req, res) => {
//     const userId = req.body.userId; // Récupérer l'ID unique de l'utilisateur à supprimer
//     console.log('Reçu pour suppression :', userId);

//     try {
//         const userCollection = db.collection('Users');
//         const wallCollection = db.collection('Wall'); // Collection des messages

//         // Supprimer l'utilisateur
//         const userResult = await userCollection.deleteOne({ _id: userId });
//         if (userResult.deletedCount === 1) {
//             console.log(`Utilisateur supprimé : ${userId}`);
//         } else {
//             console.log(`Aucun utilisateur trouvé avec l'ID : ${userId}`);
//         }

//         // Supprimer les messages de l'utilisateur dans la collection wall
//         const wallResult = await wallCollection.deleteMany({ idUser: userId });
//         console.log(`Messages supprimés dans Wall : ${wallResult.deletedCount}`);

//         // Rechargez la liste des utilisateurs après suppression
//         const users = await userCollection.find({ isAdmin: { $ne: "y" } }).toArray();
//         const nbUsers = users.length;

//         res.render('admin', { users, nbUsers });
//     } catch (err) {
//         console.error('Erreur lors de la suppression :', err);
//         res.status(500).send('Erreur serveur lors de la suppression');
//     }
// });
app.post('/admin', async (req, res) => {
    const userId = req.body.userId; // Récupérer l'ID unique de l'utilisateur à supprimer
    console.log('Reçu pour suppression :', userId);

    try {
        const userCollection = db.collection('Users');
        const chatCollection = db.collection('Chat');
        const wallCollection = db.collection('Wall'); // Collection des messages

        // Supprimer l'utilisateur
        const userResult = await userCollection.deleteOne({ _id: userId });
        if (userResult.deletedCount === 1) {
            console.log(`Utilisateur supprimé : ${userId}`);
        } else {
            console.log(`Aucun utilisateur trouvé avec l'ID : ${userId}`);
        }

        // Supprimer les messages de l'utilisateur dans la collection wall
        const wallResult = await wallCollection.deleteMany({ idUser: userId });
        await chatCollection.deleteMany({ userId: userId });
        console.log(`Messages supprimés dans Wall : ${wallResult.deletedCount}`);

        // Retirer l'utilisateur des listes d'amis des autres utilisateurs
        await userCollection.updateMany(
            { friends: userId }, // Trouver les utilisateurs ayant l'utilisateur supprimé dans leurs amis
            { $pull: { friends: userId } } // Supprimer l'utilisateur des amis
        );
        console.log(`L'utilisateur a été retiré des listes d'amis`);

        // Rechargez la liste des utilisateurs après suppression
        const users = await userCollection.find({ isAdmin: { $ne: "y" } }).toArray();
        const nbUsers = users.length;

        res.render('admin', { users, nbUsers });
    } catch (err) {
        console.error('Erreur lors de la suppression :', err);
        res.status(500).send('Erreur serveur lors de la suppression');
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
    /////////////////////////////


    try {
        console.log("<< -->>")
        console.log("dans connection")
        console.log("<< -->>")
        const collection = db.collection(process.env.MONGODB_COLLECTION);
        db.collection('Users').updateOne(
            { _id: user._id  },
            {$set: { isConnected: 'y' } }
        )

    } catch (err) {
        console.error('Erreur lors du changement isConnected :', err);
        res.status(500).send('Erreur lors du changement isConnected');
    }

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
        const timeHourMessage = `( ${hour }:${min} )`; // Format HH:mm
        const timeDayMessage = ` [ ${day}/${month+1} ] `; // Format HH:mm
        
        const messageData = {
            content: message,
            date : date,
            time: timeMessage,
            timeDay : timeDayMessage,
            timeHour : timeHourMessage,
            username: user.username || 'Anonyme',
            avatar:user.avatar,
            userId: user._id || null,
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
    socket.on('disconnect', async  (reason) => {
        console.log('Utilisateur déconnecté:', socket.id);
        console.log('Raison:', reason);
        try {
            console.log("dans deconnection")
            const collection = db.collection(process.env.MONGODB_COLLECTION);
            await db.collection('Users').updateOne(
                { _id: user._id  },
                {$set: { isConnected: 'n' } }
            )
    
        } catch (err) {
            console.error('Erreur lors du changement isConnected :', err);
            res.status(500).send('Erreur lors du changement isConnected');
        }
        userConnected = userConnected.filter(item => item !== user._id);
        nbConnected = userConnected.length;
        
        io.emit('updateNbConnected', nbConnected); // Mise à jour après déconnexion
        if (user.username) {
            console.log(`${user.username} s'est déconnecté.`);
            
        }
    });
});


