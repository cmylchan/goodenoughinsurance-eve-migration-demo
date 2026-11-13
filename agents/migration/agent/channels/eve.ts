import { eveChannel } from "eve/channels/eve";
import { goldenPathAuth } from "@ge/golden-path/eve-channel";

// Same sign-in as every golden-path agent. The requester is whoever signed in; they approve
// their own draft PR, which is the one approval this agent asks for.
export default eveChannel({ auth: goldenPathAuth() });
