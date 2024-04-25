const jwt = require("jsonwebtoken");
const tokenData = require("./token_data.json");

class TokenManager {
  static generateToken(payload) {
    return jwt.sign(payload, tokenData["secret_key"], { expiresIn: "3d" });
  }
  static checkAutentication(request) {
    try {
      let accessToken = request.headers.authorization.split(" ")[1];
      let jwtResponse = jwt.verify(
        String(accessToken),
        tokenData["secret_key"]
      );
      return jwtResponse;
    } catch (error) {
      return false;
    }
  }
  static getSecret() {
    return require("crypto").randomBytes(64).toString("hex");
  }
}

module.exports = TokenManager;
