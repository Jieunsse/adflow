package ai.adflow.api.store.brand;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stores/brand-profiles")
public class BrandProfileController extends StoreController<BrandProfile> {

  public BrandProfileController(BrandProfileRepository repository) {
    super(repository);
  }
}
