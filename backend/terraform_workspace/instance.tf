resource "oci_core_instance" "vm_instance" {
  compartment_id      = "ocid1.compartment.oc1.test"
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "terraform-vm"
  shape               = "VM.Standard.E5.Flex"

  shape_config {
    ocpus         = 2
    memory_in_gbs = 16
  }

  source_details {
    source_type = "image"
    source_id   = "ocid1.image.test"
  }

  create_vnic_details {
    subnet_id        = "ocid1.subnet.test"
    assign_public_ip = true
  }

  metadata = {
    ssh_authorized_keys = file("~/.ssh/id_rsa.pub")
  }
}

data "oci_identity_availability_domains" "ads" {
  compartment_id = "ocid1.compartment.oc1.test"
}

output "vm_public_ip" {
  value = oci_core_instance.vm_instance.public_ip
}