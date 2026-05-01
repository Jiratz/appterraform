resource "oci_containerengine_cluster" "oke_cluster" {
  compartment_id     = "ocid1.compartment.oc1.test"
  kubernetes_version = "v1.34.2"
  name               = "terraform-oke-cluster"
  vcn_id             = "ocid1.vcn.test"

  endpoint_config {
    is_public_ip_enabled = true
    subnet_id            = "ocid1.subnet.test"
  }

  options {
    add_ons {
      is_kubernetes_dashboard_enabled = false
      is_tiller_enabled               = false
    }
    kubernetes_network_config {
      pods_cidr     = "10.244.0.0/16"
      services_cidr = "10.96.0.0/16"
    }
  }
}

resource "oci_containerengine_node_pool" "oke_node_pool" {
  cluster_id         = oci_containerengine_cluster.oke_cluster.id
  compartment_id     = "ocid1.compartment.oc1.test"
  kubernetes_version = "v1.34.2"
  name               = "terraform-node-pool"
  node_shape         = "VM.Standard.E5.Flex"

  node_shape_config {
    ocpus         = 2
    memory_in_gbs = 16
  }

  node_source_details {
    image_id    = "ocid1.image.test"
    source_type = "IMAGE"
  }

  node_config_details {
    size = 2

    placement_configs {
      availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
      subnet_id           = "ocid1.subnet.test"
    }
  }
}

output "oke_cluster_id" {
  value = oci_containerengine_cluster.oke_cluster.id
}