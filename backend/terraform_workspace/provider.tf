terraform {
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 6.0"
    }
  }
}

provider "oci" {
  tenancy_ocid     = "ocid1.tenancy.oc1.test"
  user_ocid        = "ocid1.user.oc1.test"
  fingerprint      = "aa:bb:cc:dd:ee:ff"
  private_key_path = "/Users/jiratz-mac/Desktop/appterraform/backend/terraform_workspace/oci_api_key.pem"
  region           = "ap-pathumthani-1"
}