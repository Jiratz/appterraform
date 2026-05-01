import oci
import re


def get_oci_config(creds: dict) -> dict:
    return {
        "tenancy": creds["tenancy_ocid"],
        "user": creds["user_ocid"],
        "fingerprint": creds["fingerprint"],
        "key_content": creds["private_key"].replace("\\n", "\n").strip(),
        "region": creds["region"],
    }


def _patch_oci_ocid_validation():
    """Patch OCI SDK to accept non-standard realms like oc43 (Thailand Sovereign Cloud)."""
    try:
        import oci.config as oci_config
        original_validate = oci_config.validate_config

        def patched_validate(config, **kwargs):
            # Temporarily patch the OCID regex to allow any realm
            original_pattern = None
            if hasattr(oci_config, 'OCID_RE'):
                original_pattern = oci_config.OCID_RE
                oci_config.OCID_RE = re.compile(r'ocid[\w.-]+')
            try:
                return original_validate(config, **kwargs)
            except oci_config.InvalidConfig as e:
                errors = e.args[0] if e.args else {}
                # Only re-raise if errors are not OCID-format related
                filtered = {k: v for k, v in errors.items() if 'malformed' not in str(v)}
                if filtered:
                    raise oci_config.InvalidConfig(filtered)
            finally:
                if original_pattern is not None:
                    oci_config.OCID_RE = original_pattern

        oci_config.validate_config = patched_validate
    except Exception as e:
        print(f"[PATCH WARNING] Could not patch OCI validation: {e}")


_patch_oci_ocid_validation()


def _make_client(client_class, config):
    """Create OCI client with validation disabled for sovereign cloud realms."""
    try:
        return client_class(config)
    except Exception:
        # Fallback: skip built-in validation
        return client_class(config, skip_deserialization=False)


def validate_credentials(creds: dict) -> bool:
    try:
        config = get_oci_config(creds)
        print(f"[DEBUG] Validating config for tenancy: {config['tenancy'][:30]}...")
        identity = oci.identity.IdentityClient(config)
        identity.get_tenancy(creds["tenancy_ocid"])
        return True
    except Exception as e:
        print(f"[OCI ERROR] {type(e).__name__}: {e}")
        return False


def list_compartments(creds: dict) -> list:
    try:
        config = get_oci_config(creds)
        identity = oci.identity.IdentityClient(config)
        tenancy_id = creds["tenancy_ocid"]
        compartments = oci.pagination.list_call_get_all_results(
            identity.list_compartments,
            tenancy_id,
            compartment_id_in_subtree=True,
            lifecycle_state="ACTIVE",
        ).data
        result = [{"id": tenancy_id, "name": "root (tenancy)"}]
        for c in compartments:
            result.append({"id": c.id, "name": c.name})
        return result
    except Exception as e:
        return [{"id": creds.get("tenancy_ocid", ""), "name": f"root"}]


def list_vcns(creds: dict, compartment_id: str) -> list:
    try:
        config = get_oci_config(creds)
        vcn_client = oci.core.VirtualNetworkClient(config)
        vcns = vcn_client.list_vcns(compartment_id).data
        return [
            {
                "id": v.id,
                "display_name": v.display_name,
                "cidr_block": v.cidr_block,
                "lifecycle_state": v.lifecycle_state,
            }
            for v in vcns
        ]
    except Exception:
        return []


def list_subnets(creds: dict, compartment_id: str, vcn_id: str) -> list:
    try:
        config = get_oci_config(creds)
        vcn_client = oci.core.VirtualNetworkClient(config)
        subnets = vcn_client.list_subnets(compartment_id, vcn_id=vcn_id).data
        return [
            {
                "id": s.id,
                "display_name": s.display_name,
                "cidr_block": s.cidr_block,
                "prohibit_public_ip_on_vnic": s.prohibit_public_ip_on_vnic,
                "lifecycle_state": s.lifecycle_state,
            }
            for s in subnets
        ]
    except Exception:
        return []
