// Démarre le relais des appels bloqués par le seul fait d'être importé (voir js/violations.js) : à importer en premier dans le module d'entrée de l'app, pour que le relais écoute avant que les
// autres modules s'évaluent.
import { Violations } from './violations.js';

Violations.start();
