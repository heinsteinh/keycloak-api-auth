import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'weather',
  clientId: 'weather-frontend',
});

export default keycloak;
