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

const cookieParser = require('cookie-parser');



// Connexion à MongoDB
// const connectionString = `mongodb://${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}`;

const session = require('express-session');

app.use(cookieParser());
app.use(session({
    secret: 'my-application-oscompaneros',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // En production, pensez à le passer à true si vous utilisez HTTPS
}));
const connectionString = process.env.MONGODB_URI;
const client = new MongoClient(connectionString);
const dbName = process.env.MONGODB_DBNAME;

// const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//         user: process.env.EMAIL,
//         pass: process.env.EMAIL_PASSWORD,
//     },
//     secure: false, // Ajoute cette ligne si tu rencontres des erreurs SSL
//     tls: {
//         rejectUnauthorized: false, // Désactive le rejet des certificats auto-signés
//     },
// });

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

// Middleware pour partager la session avec Socket.IO
// io.use((socket, next) => {
//     const req = socket.request; // La requête WebSocket
//     const res = req.res || {};   // La réponse associée (pas toujours disponible)
//     console.log('Avant session:', req.session);

//     // Le middleware Express pour gérer la session
//     session({ 
//         secret: 'my-application-oscompaneros', 
//         resave: false, 
//         saveUninitialized: true,
//         cookie: { secure: false }
//     })(req, res, next); // Applique express-session au socket
// });

io.use((socket, next) => {
    const req = socket.request;
    const res = req.res || {};

    console.log('Avant session WebSocket:', req.session);

    session({
        secret: 'my-application-oscompaneros',
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false }
    })(req, res, (err) => {
        if (err) {
            console.log('Erreur session:', err);
            return next(err);
        }

        console.log('Après session WebSocket:', req.session);
        next();
    });
});
  

// Route pour soumettre des tâches
app.post('/', async (req, res) => {
    const user = req.session.user || "";
    const task = {
        id: uuidv4(),
        name: req.body.task,
        idUser:user._id,
        date: new Date(),
        username: req.session.user ? req.session.user.username : "Anonyme",
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

// app.post('/comment', async (req, res) => {
//     const user = req.session.user || "";
//     const { comment, parentCommentId } = req.body; // Récupérer le commentaire et le parent ID
//     console.log("Dans /comment user : ", user);
//     console.log("Commentaire : ", comment);
//     console.log("Parent Comment ID : ", parentCommentId);

//     const newComment = {
//         idUser: user._id,
//         username: user.username,
//         avatar: user.avatar || "/assets/avatar/default.png",
//         commentaire: comment,
//         date: new Date(),
//         parentCommentId: parentCommentId || null,  // Si c'est une réponse, on met le parentCommentId
//     };

//     console.log("Message ajouté : ", newComment);

//     try {
//         const collection = db.collection('Wall2'); // La collection des commentaires
//         await collection.insertOne(newComment);  // Insertion du commentaire ou réponse

//         // if (parentCommentId) {
//         //     // Si c'est une réponse, on met à jour la tâche dans la collection de tâches
//         //     const tasksCollection = db.collection(process.env.MONGODB_COLLECTION);
//         //     await tasksCollection.updateOne(
//         //         { _id: parentCommentId }, // Trouver la tâche correspondante
//         //         { $push: { responses: newComment } } // Ajouter la réponse au tableau 'responses'
//         //     );
//         // }

//         res.redirect('/'); // Redirection après l'ajout
//     } catch (err) {
//         console.error('Erreur lors de l\'ajout du commentaire :', err);
//         res.status(500).send('Erreur lors de l\'ajout du commentaire');
//     }
// });


app.get('/login', async (req, res) => {
    // const success = req.query.success === 'true'; // Vérification du paramètre de succès
    // const successCourse = req.query.successCourse === 'true';
     

    // try {
    //     const today = new Date();
    //     today.setHours(0, 0, 0, 0);
    //     const tomorrow = new Date(today);
    //     tomorrow.setDate(today.getDate() + 1);

    //     console.log('Today:', today);
    //     console.log('Tomorrow:', tomorrow);

    //     const collection = db.collection(process.env.MONGODB_COLLECTION);
    //     const collectionCourses = db.collection('Courses');
    //     const tasks = await collection.find({}).sort({ date: -1 }).toArray();
    //     const courses = await collectionCourses.find({}).toArray();
    //     tasks.forEach(task => {
    //       console.log('Original Date:', task.date.toString().slice(0, 10));
          
    //     });

        res.render('login')
        ;
    // } catch (err) {
    //     console.error('Erreur lors de la récupération des tâches :', err);
    //     res.status(500).send('Erreur lors de la récupération des tâches');
    // }
});

app.post('/login', async (req, res) => {
    // const success = req.query.success === 'true'; // Vérification du paramètre de succès
    // const successCourse = req.query.successCourse === 'true';
     const user={
        username:req.body.username,
        password:req.body.password
     }

    try {


        const collection = db.collection('Users');
        const userLogged = await collection.findOne({userName:user.username})
        // console.log("----------------------")
        // console.log(userLogged.userName)
        // console.log(userLogged.password)
        // // console.log("UserLogged",userLogged)
        // console.log("----------------------")
        if(userLogged && userLogged.password===user.password ){

            req.session.user = {
                 _id: userLogged._id,
                username: userLogged.userName,
                firstname : userLogged.firstname,
                lastname : userLogged.lastname,
                email : userLogged.email,
                avatar: userLogged.avatar // Assurez-vous que l'avatar est bien dans la base de données
            }  
                if(userLogged.isAdmin==="y"){
                    console.log("dans admin")
                    res.redirect('/admin')
                }
                else{
                    console.log("users")
                    res.redirect('/') 
                }
            
        }

        else{
            res.render('login',{
                message:"Login ou mot de pass erroné !"
            })
        }

    //     const collectionCourses = db.collection('Courses');
    //     const tasks = await collection.find({}).sort({ date: -1 }).toArray();
    //     const courses = await collectionCourses.find({}).toArray();
    //     tasks.forEach(task => {
    //       console.log('Original Date:', task.date.toString().slice(0, 10));
          
    //     });

        
        ;
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

    // const success = req.query.success === 'true'; // Vérification du paramètre de succès
    // const successCourse = req.query.successCourse === 'true';
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
        // console.log("users",users)
        // console.log("users",users)
        res.render('find',{
            user,
            users
        })
        ;
     } catch (error) {
        console.error('Erreur lors de la récupération des userst :', err);
        res.status(500).send('Erreur lors de la récupération des users');
     }

    // try {
    //     const today = new Date();
    //     today.setHours(0, 0, 0, 0);
    //     const tomorrow = new Date(today);
    //     tomorrow.setDate(today.getDate() + 1);

    //     console.log('Today:', today);
    //     console.log('Tomorrow:', tomorrow);

    //     const collection = db.collection(process.env.MONGODB_COLLECTION);
    //     const collectionCourses = db.collection('Courses');
    //     const tasks = await collection.find({}).sort({ date: -1 }).toArray();
    //     const courses = await collectionCourses.find({}).toArray();
    //     tasks.forEach(task => {
    //       console.log('Original Date:', task.date.toString().slice(0, 10));
          
    //     });

       
    // } catch (err) {
    //     console.error('Erreur lors de la récupération des tâches :', err);
    //     res.status(500).send('Erreur lors de la récupération des tâches');
    // }
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

// app.get('/chatPublic',async (req,res)=>{
//     const success = req.query.success === 'true';
//     const successCourse = req.query.successCourse === 'true';
//     const user = req.session.user || "";
//     console.log("user name session",user)

//     io.on('connection', (socket) => {
//         console.log("Utilisateur connecté à Socket.IO");
//         const user = socket.request.session.user || ''; // Récupérer l'utilisateur de la session
//         console.log(`Nom d'utilisateur dans la session : ${user}`)
    
//         socket.on('messageChat', (message, username) => {
//             console.log("Message reçu: ", message, "de", user.username);
//             io.emit('nouveauMessage', message, username); // Diffuse le message à tous les clients
//         });
//     });

//     try {
//         if (!user) {
//             return res.redirect('/login'); // Redirection si l'utilisateur n'est pas connecté
//         }

//         const collection = db.collection(process.env.MONGODB_COLLECTION);
//         const collectionUsers = db.collection('Users');

//         // Récupération de l'utilisateur connecté
//         const currentUser = await collectionUsers.findOne({ _id: user._id });

//         if (!currentUser) {
//             return res.status(400).send("Utilisateur introuvable !");
//         }

//         // Récupérer les IDs des amis
//         const friendsIds = currentUser.friends || [];

//         // Ajouter l'ID de l'utilisateur connecté pour inclure ses propres messages
//         friendsIds.push(currentUser._id);

//         // Filtrer les tâches par `idUser`
//         const tasks = await collection
//             .find({ idUser: { $in: friendsIds } }) // Filtre par les IDs des amis et de l'utilisateur
//             .sort({ date: -1 })
//             .toArray();


//         res.render('chatPublic', {
//             title: 'Mon site',
//             message: 'Bienvenue sur ma montre digitale',
//             tasks: tasks || [],
//             successCourse,
//             success,
//             user
//         });
//     } catch (err) {
//         console.error('Erreur lors de la récupération des tâches :', err);
//         res.status(500).send('Erreur lors de la récupération des tâches');
//     }
// })

app.get('/chatPublic', async (req, res) => {
    const success = req.query.success === 'true';
    const successCourse = req.query.successCourse === 'true';
    const user = req.session.user || '';
    console.log("Nom d'utilisateur dans la session (HTTP) :", user);

    // Connexion à Socket.IO
    // io.on('connection', (socket) => {
    //     console.log("Utilisateur connecté à Socket.IO");

    //     // Récupérer l'utilisateur de la session de Socket.IO
    //     const socketUser = socket.request.session.user || ''; // Récupérer l'utilisateur de la session
    //     console.log(`Nom d'utilisateur dans la session (Socket.IO) : ${socketUser.username}`);

    //     socket.on('messageChat', (message) => {
    //         console.log("Message reçu: ", message, "de", socketUser.username);
    //         io.emit('nouveauMessage', message); // Diffuse le message à tous les clients
    //     });
    // });

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
        friendsIds.push(currentUser._id);

        // Filtrer les tâches par `idUser`
        const tasks = await collection
            .find({ idUser: { $in: friendsIds } }) // Filtre par les IDs des amis et de l'utilisateur
            .sort({ date: -1 })
            .toArray();

        res.render('chatPublic', {
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

        // // Vérifie si l'utilisateur est déjà un ami
        // if (!currentUser.friends.includes(userId)) {
        //     return res.status(400).send('Cet utilisateur n\'est pas dans votre liste d\'amis');
        // }

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

        // Met à jour la session
        req.session.user = currentUser;

        console.log('Liste des amis mise à jour :', currentUser.friends);

        // Redirige vers la page précédente
        res.redirect('/profil');
    } catch (err) {
        console.error('Erreur lors de la suppression de l\'utilisateur dans la liste des amis :', err);
        res.status(500).send('Erreur serveur');
    }
});

app.get('/profil', async (req, res) => {
    const user = req.session.user || "";

    const userId = req.session.user._id || "";
    const usersLoggedFriends = await db.collection('Users')
    .find({_id:{$eq:userId}})
    .toArray();

    let nbUsersLoggedFriends = 0
   
    if (usersLoggedFriends[0].friends) {
        nbUsersLoggedFriends = usersLoggedFriends[0].friends.length 
    }

    const friendsId = usersLoggedFriends[0].friends || []; // Tableau des IDs des amis

    // console.log("friendsId : ",friendsId)

    //     // Récupérer les informations des amis en une seule requête
        const friends = await db.collection('Users')
            .find({ _id: { $in: friendsId } })
            // .project({ userName: 1,_id : 0}) 
            // .sort({userName:1})
            .sort({userName:1})
            .toArray();

        // console.log("Amis trouvés :", friends);

    // console.log("user dans profil ",user)
    // const success = req.query.success === 'true'; // Vérification du paramètre de succès
    // const successCourse = req.query.successCourse === 'true';
     

    // try {
    //     const today = new Date();
    //     today.setHours(0, 0, 0, 0);
    //     const tomorrow = new Date(today);
    //     tomorrow.setDate(today.getDate() + 1);

    //     console.log('Today:', today);
    //     console.log('Tomorrow:', tomorrow);

    //     const collection = db.collection(process.env.MONGODB_COLLECTION);
    //     const collectionCourses = db.collection('Courses');
    //     const tasks = await collection.find({}).sort({ date: -1 }).toArray();
    //     const courses = await collectionCourses.find({}).toArray();
    //     tasks.forEach(task => {
    //       console.log('Original Date:', task.date.toString().slice(0, 10));
          
    //     });

        res.render('profil',{
            user,
            nbUsersLoggedFriends,
            friends
        })
        ;
    // } catch (err) {
    //     console.error('Erreur lors de la récupération des tâches :', err);
    //     res.status(500).send('Erreur lors de la récupération des tâches');
    // }
});

app.get('/register', async (req, res) => {
    // const success = req.query.success === 'true'; // Vérification du paramètre de succès
    // const successCourse = req.query.successCourse === 'true';
     

    // try {
    //     const today = new Date();
    //     today.setHours(0, 0, 0, 0);
    //     const tomorrow = new Date(today);
    //     tomorrow.setDate(today.getDate() + 1);

    //     console.log('Today:', today);
    //     console.log('Tomorrow:', tomorrow);

    //     const collection = db.collection(process.env.MONGODB_COLLECTION);
    //     const collectionCourses = db.collection('Courses');
    //     const tasks = await collection.find({}).sort({ date: -1 }).toArray();
    //     const courses = await collectionCourses.find({}).toArray();
    //     tasks.forEach(task => {
    //       console.log('Original Date:', task.date.toString().slice(0, 10));
          
    //     });

        res.render('register')
        ;
    // } catch (err) {
    //     console.error('Erreur lors de la récupération des tâches :', err);
    //     res.status(500).send('Erreur lors de la récupération des tâches');
    // }
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

// app.post('/admin', async (req, res) => {
//     console.log('dans admin post');
//     try {
//         // Traiter les actions du formulaire ici si nécessaire
//         const collection = db.collection('Users');
//         const users = await collection.find().toArray();

//         res.render('admin', {
//             users // Passe les utilisateurs au template
//         });
//     } catch (err) {
//         console.error('Erreur lors de la récupération des utilisateurs:', err);
//         res.status(500).send('Erreur lors de la récupération des utilisateurs');
//     }
// })

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
    // const success = req.query.success === 'true'; // Vérification du paramètre de succès
    // const successCourse = req.query.successCourse === 'true';
     

    // try {
    //     const today = new Date();
    //     today.setHours(0, 0, 0, 0);
    //     const tomorrow = new Date(today);
    //     tomorrow.setDate(today.getDate() + 1);

    //     console.log('Today:', today);
    //     console.log('Tomorrow:', tomorrow);

    //     const collection = db.collection(process.env.MONGODB_COLLECTION);
    //     const collectionCourses = db.collection('Courses');
    //     const tasks = await collection.find({}).sort({ date: -1 }).toArray();
    //     const courses = await collectionCourses.find({}).toArray();
    //     tasks.forEach(task => {
    //       console.log('Original Date:', task.date.toString().slice(0, 10));
          
    //     });

        res.render('password-email')
        ;
    // } catch (err) {
    //     console.error('Erreur lors de la récupération des tâches :', err);
    //     res.status(500).send('Erreur lors de la récupération des tâches');
    // }
});

app.post('/password-email', (req, res) => {
    const email = req.body.email;
    // console.log(email)
  
    // Vérifiez si un email est fourni
    if (!email) {
      return res.status(400).send('Email is required');
    }
  
    // Contenu de l'email
    const mailOptions = {
      from: "alt.fi-0ox8z6xo@yopmail.com",
      to: email,
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
// io.on('connection', (socket) => {
//     console.log("Utilisateur connecté à Socket.IO");
//     const user = socket.request.session.user || ''; // Récupérer l'utilisateur de la session
//     console.log(`Nom d'utilisateur dans la session : ${user}`)

//     socket.on('messageChat', (message, username) => {
//         console.log("Message reçu: ", message, "de", username);
//         io.emit('nouveauMessage', message, username); // Diffuse le message à tous les clients
//     });
// });
io.on('connection', (socket) => {
    console.log("Utilisateur connecté à Socket.IO");
    const req = socket.request;
    // Vérifie si la session contient des informations sur l'utilisateur
    if (req.session && req.session.username) {
        console.log('Nom d\'utilisateur connecté:', req.session.username);
    } else {
        console.log('Aucune session trouvée.');
    }
    // Vérifiez si l'utilisateur est connecté et récupérez ses informations
    const user = socket.request.session.user || {};  // Récupère l'utilisateur depuis la session
    console.log(`Nom d'utilisateur dans la session : ${user.username}`); // Affiche le username

    // Assurez-vous que l'utilisateur est défini avant d'envoyer ou de recevoir des messages
    socket.on('messageChat', (message) => {
        console.log("Message reçu:", message, "de", user.username);
        io.emit('nouveauMessage', message, user.username); // Diffuse le message à tous les clients
    });
});
// io.on('connection', (socket) => {
//     console.log('Utilisateur connecté à Socket.IO');

//     // Gérer la réception d'un message depuis un client
//     socket.on('messageChat', (message, username) => {
//         console.log(`Message reçu de ${username} : ${message}`);

//         // Ajouter un traitement supplémentaire si nécessaire
//         // Exemple : sauvegarder dans la base de données
//         const messageData = {
//             username: username,
//             content: message,
//             timestamp: new Date(),
//         };

//         // Si vous voulez enregistrer ce message dans MongoDB
//         // const collection = db.collection(process.env.MONGODB_COLLECTION_CHAT); // Assurez-vous d'avoir défini cette collection dans votre .env
//         // collection.insertOne(messageData, (err, result) => {
//         //     if (err) {
//         //         console.error('Erreur lors de l\'insertion du message dans la base de données', err);
//         //         return;
//         //     }
//         //     console.log('Message sauvegardé avec succès dans la base de données');
//         // });

//         // Diffuser le message à tous les clients connectés
//         const formattedMessage = `${messageData.username} : ${messageData.content}`;
//         io.emit('nouveauMessage', formattedMessage);
//     });

//     // Gérer la déconnexion d'un utilisateur
//     socket.on('disconnect', () => {
//         console.log('Utilisateur déconnecté de Socket.IO');
//     });
// });

