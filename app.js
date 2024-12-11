const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const { MongoClient, ObjectId } = require('mongodb');

const app = express();

// Connexion à MongoDB
// const connectionString = `mongodb://${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}`;
const connectionString = process.env.MONGODB_URI;
const client = new MongoClient(connectionString);
const dbName = process.env.MONGODB_DBNAME;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
    },
    secure: false, // Ajoute cette ligne si tu rencontres des erreurs SSL
    tls: {
        rejectUnauthorized: false, // Désactive le rejet des certificats auto-signés
    },
});

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

// Route pour soumettre des tâches
app.post('/', async (req, res) => {
    const task = {
        id: uuidv4(),
        name: req.body.task,
        date: new Date(), // Convertir la chaîne en un objet Date
        // description: req.body.description,
        // priority: req.body.priority
    };

    try {
        const collection = db.collection(process.env.MONGODB_COLLECTION);
        await collection.insertOne(task);
        res.redirect('/?success=true'); // Redirection avec un paramètre de succès
    } catch (err) {
        console.error('Erreur lors de l\'ajout de la tâche :', err);
        res.status(500).send('Erreur lors de l\'ajout de la tâche');
    }
});

app.post('/Courses', async (req, res) => {
    const course = {
        name: req.body.buy,
        priority2: req.body.priority2
    };

    try {
        const collection = db.collection('Courses'); // Utiliser la collection "courses"
        await collection.insertOne(course);
        res.redirect('/?successCourse=true'); // Redirection avec un paramètre de succès pour les courses
    } catch (err) {
        console.error('Erreur lors de l\'ajout de la course :', err);
        res.status(500).send('Erreur lors de l\'ajout de la course');
    }
});

// Route pour la page d'accueil
app.get('/', async (req, res) => {
    const success = req.query.success === 'true'; // Vérification du paramètre de succès
    const successCourse = req.query.successCourse === 'true';
     

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        console.log('Today:', today);
        console.log('Tomorrow:', tomorrow);

        const collection = db.collection(process.env.MONGODB_COLLECTION);
        const collectionCourses = db.collection('Courses');
        const tasks = await collection.find({}).sort({ date: -1 }).toArray();
        const courses = await collectionCourses.find({}).toArray();
        tasks.forEach(task => {
          console.log('Original Date:', task.date.toString().slice(0, 10));
          
        });

        res.render('index', { 
            title: 'Mon site', 
            message: 'Bienvenue sur ma montre digitale', 
            tasks: tasks || [], 
            courses: courses || [],
            successCourse,
            success 
        });
    } catch (err) {
        console.error('Erreur lors de la récupération des tâches :', err);
        res.status(500).send('Erreur lors de la récupération des tâches');
    }
});
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
app.get('/find', async (req, res) => {
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

        res.render('find')
        ;
    // } catch (err) {
    //     console.error('Erreur lors de la récupération des tâches :', err);
    //     res.status(500).send('Erreur lors de la récupération des tâches');
    // }
});
app.get('/profil', async (req, res) => {
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

        res.render('profil')
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
    const user = {
        _id: uuidv4(),
        userName: req.body.username,
        firstname: req.body.firstname,
        avatar:req.body.avatar,
        // lastname: req.body.lastname,
        // genre: req.body.genre,
        // email: req.body.email,
        // telephone: req.body.telephone,
        // age: req.body.age,
        // presentation: req.body.presentation,
        // centreInterets: req.body.centreInterets,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword
    };
    console.log("user 2: ",user)

    if(user.password===user.confirmPassword){
     try {
        const collection = db.collection('Users'); // Utiliser la collection "users"
        // const usersEmail = await collection.findOne({ EMAIL: joueur });
        await collection.insertOne(user);
        res.redirect('/'); // Redirection avec un paramètre de succès pour les courses
    } catch (err) {
        console.error('Erreur lors de l\'ajout du compte :', err);
        res.status(500).send('Erreur lors de l\'ajout du compte');
    }   
    }
    else{
        
        res.render('register',{
            message:"Passwords do not match !"
        })
      
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
    console.log(email)
  
    // Vérifiez si un email est fourni
    if (!email) {
      return res.status(400).send('Email is required');
    }
  
    // Contenu de l'email
    const mailOptions = {
      from: process.env.EMAIL,
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
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
