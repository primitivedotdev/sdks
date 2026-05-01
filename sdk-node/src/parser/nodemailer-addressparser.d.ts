declare module "nodemailer/lib/addressparser/index.js" {
  export interface AddressParserAddress {
    address?: string;
    name?: string;
  }

  export default function addressparser(input: string): AddressParserAddress[];
}
